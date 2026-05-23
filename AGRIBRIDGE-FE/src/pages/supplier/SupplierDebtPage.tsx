import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { AlertTriangle, Bell, CircleHelp, CreditCard, Download, FileText, Loader2, ReceiptText, Settings, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import XLSXStyle from 'xlsx-js-style'
import { FilterTabBar, SearchInput, SupplierPanel } from '../../components/supplier/SupplierCommon'
import { DebtReminderList, type DebtReminderCardItem } from '../../components/debt/DebtReminderCard'
import { PaymentTimelineGroup, type PaymentHistoryItem } from '../../components/debt/PaymentHistory'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'
import {
  createSupplierDebtAdjustment,
  createSupplierDebtPayment,
  createSupplierDebtReminder,
  fetchSupplierDebtBuyerDetail,
  fetchSupplierDebts,
  saveSupplierCreditLimit,
  type SupplierDebtBuyer,
  type SupplierDebtBuyerDetail,
  type SupplierDebtInvoice,
  type SupplierDebtOverview,
} from '../../services/supplierDebtApi'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

const emptyOverview: SupplierDebtOverview = { kpis: [], buyers: [] }
const emptyText = 'Chưa có'
const creditLimitStatusOptions = [
  { value: 'ACTIVE', label: 'Đang áp dụng' },
  { value: 'SUSPENDED', label: 'Tạm khóa' },
  { value: 'CLOSED', label: 'Ngưng cấp' },
] as const

type CreditLimitUiStatus = typeof creditLimitStatusOptions[number]['value']
type DebtLedgerTab = 'credit' | 'deposit'
type DebtStatCard = { id: string; label: string; value: string }

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('vi-VN')}đ`
}

function formatCurrency(value?: number | null) {
  return formatMoney(value)
}

function formatNumber(value?: number | null) {
  return Number(value ?? 0).toLocaleString('vi-VN')
}

function isThisMonth(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatMoneyInput(value: string | number) {
  const amount = typeof value === 'number' ? value : parseMoneyInput(value)
  return amount > 0 ? amount.toLocaleString('vi-VN') : ''
}

function formatDate(value?: string | null) {
  if (!value) return emptyText
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}

// ─── Excel Export ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DebtWS = any

function debtCell(v: unknown, t = 's') {
  return { v, t }
}

function debtStyle(
  bg: string,
  color = '1E293B',
  bold = false,
  align: 'left' | 'center' | 'right' = 'left',
  fontSize = 10,
  border = false,
) {
  return {
    font: { bold, sz: fontSize, color: { rgb: color }, name: 'Calibri' },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center', wrapText: false },
    ...(border ? { border: { bottom: { style: 'hair', color: { rgb: 'CBD5E1' } }, left: { style: 'hair', color: { rgb: 'CBD5E1' } }, right: { style: 'hair', color: { rgb: 'CBD5E1' } } } } : {}),
  }
}

function applyDebtStyle(ws: DebtWS, addr: string, style: object, numFmt?: string) {
  if (!ws[addr]) ws[addr] = debtCell('')
  ws[addr].s = style
  if (numFmt) ws[addr].z = numFmt
}

function debtSheetHeader(ws: DebtWS, title: string, subtitle: string, cols: number, titleBg: string, hdrBg: string) {
  const letters = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i))
  letters.forEach((c) => {
    applyDebtStyle(ws, `${c}1`, debtStyle(titleBg, 'FFFFFF', true, 'center', 14))
    applyDebtStyle(ws, `${c}2`, debtStyle('F8FAFC', '64748B', false, 'center', 9))
    applyDebtStyle(ws, `${c}4`, debtStyle(hdrBg, 'FFFFFF', true, 'center', 10))
  })
  if (ws['A1']) ws['A1'].v = title
  if (ws['A2']) ws['A2'].v = subtitle
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
  ]
}

type DebtExportParams = {
  ledgerTab: DebtLedgerTab
  buyers: SupplierDebtBuyer[]
  detailsByBuyer: Record<number, SupplierDebtBuyerDetail>
  kpiStats: DebtStatCard[]
}

function downloadDebtExcel({ ledgerTab, buyers, detailsByBuyer, kpiStats }: DebtExportParams) {
  const wb = XLSXStyle.utils.book_new()
  const dateStr = new Date().toLocaleDateString('vi-VN')
  const ledgerLabel = ledgerTab === 'credit' ? 'Công nợ' : 'Cọc 50%'
  const subtitle = `Loại: ${ledgerLabel}   ·   Xuất ngày: ${dateStr}   ·   AgriBridge`

  // ── Sheet 1: Tổng kết KPI ──────────────────────────────────────────────────
  const kpiRows: unknown[][] = [
    ['TỔNG KẾT CÔNG NỢ - AGRIBRIDGE', ''],
    [subtitle, ''],
    [''],
    ['CHỈ SỐ', 'GIÁ TRỊ'],
    ...kpiStats.map((k) => [k.label, k.value]),
    [''],
    ['Tổng khách hàng trong báo cáo', buyers.length],
  ]
  const wsKpi = XLSXStyle.utils.aoa_to_sheet(kpiRows)
  wsKpi['!cols'] = [{ wch: 36 }, { wch: 24 }]
  wsKpi['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...kpiStats.map(() => ({ hpt: 20 })), { hpt: 6 }, { hpt: 20 }]
  debtSheetHeader(wsKpi, 'TỔNG KẾT CÔNG NỢ - AGRIBRIDGE', subtitle, 2, '064E3B', '047857')
  kpiStats.forEach((_, i) => {
    const r = 5 + i
    const bg = i % 2 === 0 ? 'FFFFFF' : 'F0FDF4'
    applyDebtStyle(wsKpi, `A${r}`, debtStyle(bg, '1E293B', true, 'left', 10, true))
    applyDebtStyle(wsKpi, `B${r}`, debtStyle(bg, '065F46', true, 'right', 10, true))
  })
  XLSXStyle.utils.book_append_sheet(wb, wsKpi, 'Tổng kết')

  // ── Sheet 2: Chi tiết hóa đơn ─────────────────────────────────────────────
  const COLS = ['KHÁCH HÀNG', 'LOẠI CÔNG NỢ', 'MÃ HÓA ĐƠN', 'MÃ ĐƠN', 'SẢN PHẨM', 'NGÀY TẠO', 'HẠN THANH TOÁN', 'TỔNG TIỀN (VNĐ)', 'ĐÃ THU (VNĐ)', 'ĐIỀU CHỈNH (VNĐ)', 'CÒN PHẢI THU (VNĐ)', 'TRẠNG THÁI', 'HẠN MỨC (VNĐ)', 'CÒN HẠN MỨC (VNĐ)', 'NHẮC NỢ']
  const invoiceDataRows: unknown[][] = []

  buyers.forEach((buyer) => {
    const buyerDetail = detailsByBuyer[buyer.buyerId]
    const ledgerInvoices = invoicesForLedger(buyerDetail?.invoices ?? [], ledgerTab)
    if (!ledgerInvoices.length) {
      invoiceDataRows.push([
        buyer.buyerName, ledgerLabel, '', '', '', '', '',
        Number(buyer.totalAmount ?? 0), Number(buyer.paidAmount ?? 0), 0, Number(buyer.remainingAmount ?? 0),
        supplierStatusLabel(buyer), Number(buyer.creditLimit ?? 0), Number(buyer.remainingCredit ?? 0),
        reminderColumnLabel(buyerDetail?.reminders ?? []),
      ])
      return
    }
    ledgerInvoices.forEach((invoice) => {
      invoiceDataRows.push([
        buyer.buyerName,
        paymentPlanLabel(invoice.paymentPlanType, invoice.paymentTermDays, buyer.creditLimit),
        displayInvoiceCode(invoice),
        invoice.orderCode ?? invoice.orderRef ?? '',
        productSummary(invoice),
        formatDate(invoice.createdAt),
        formatDueDate(invoice),
        Number(invoice.totalAmount ?? 0),
        Number(invoice.paidAmount ?? 0),
        Number(invoice.adjustmentAmount ?? 0),
        invoiceOutstandingAmount(invoice),
        invoiceStatusLabel(invoice),
        Number(buyer.creditLimit ?? 0),
        Number(buyer.remainingCredit ?? 0),
        canSendReminder(invoice) ? 'Cần nhắc' : reminderBlockedLabel(invoice),
      ])
    })
  })

  const detailRows: unknown[][] = [
    Array(COLS.length).fill(''),  // row 1: title (set by debtSheetHeader)
    Array(COLS.length).fill(''),  // row 2: subtitle
    Array(COLS.length).fill(''),  // row 3: spacer
    COLS,
    ...invoiceDataRows,
  ]
  const wsDetail = XLSXStyle.utils.aoa_to_sheet(detailRows)
  wsDetail['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 30 },
    { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
  ]
  wsDetail['!rows'] = [
    { hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 },
    ...invoiceDataRows.map(() => ({ hpt: 18 })),
  ]
  debtSheetHeader(wsDetail, 'CHI TIẾT HÓA ĐƠN CÔNG NỢ', subtitle, COLS.length, '1E3A8A', '1D4ED8')
  const MONEY_COLS = [7, 8, 9, 10, 12, 13] // 0-indexed
  const STATUS_COL = 11
  const REMIND_COL = 14
  invoiceDataRows.forEach((row, ri) => {
    const excelRow = 5 + ri
    const bg = ri % 2 === 0 ? 'FFFFFF' : 'EFF6FF'
    ;(row as unknown[]).forEach((_, ci) => {
      const colLetter = String.fromCharCode(65 + ci)
      const addr = `${colLetter}${excelRow}`
      let color = '1E293B'
      let bold = false
      let align: 'left' | 'center' | 'right' = 'left'
      let numFmt: string | undefined
      if (MONEY_COLS.includes(ci)) { color = ci === 10 ? '6D28D9' : ci >= 12 ? '0F766E' : '065F46'; bold = true; align = 'right'; numFmt = '#,##0' }
      else if (ci === STATUS_COL) {
        const val = String(row[ci] ?? '')
        color = val.includes('Quá hạn') ? 'B91C1C' : val.includes('Sắp') ? '92400E' : val.includes('Đã') ? '065F46' : '1E293B'
        bold = true; align = 'center'
      } else if (ci === REMIND_COL) { color = String(row[ci] ?? '').includes('Cần nhắc') ? 'B45309' : '475569'; align = 'center' }
      else if (ci <= 1) { bold = ci === 0 }
      else { align = 'center' }
      applyDebtStyle(wsDetail, addr, debtStyle(bg, color, bold, align, 10, true), numFmt)
    })
  })
  XLSXStyle.utils.book_append_sheet(wb, wsDetail, 'Chi tiết hóa đơn')

  // ── Sheet 3: Lịch sử thanh toán ───────────────────────────────────────────
  const pmtRows: unknown[][] = []
  buyers.forEach((buyer) => {
    const buyerDetail = detailsByBuyer[buyer.buyerId]
    ;(buyerDetail?.payments ?? []).forEach((p) => {
      pmtRows.push([
        buyer.buyerName,
        formatDate(p.paymentDate),
        Number(p.amount ?? 0),
        p.paymentMethod ?? '',
        p.note ?? '',
        p.invoiceId ? `INV-${p.invoiceId}` : '',
      ])
    })
  })
  const PMT_COLS = ['KHÁCH HÀNG', 'NGÀY THANH TOÁN', 'SỐ TIỀN (VNĐ)', 'PHƯƠNG THỨC', 'GHI CHÚ', 'MÃ HÓA ĐƠN']
  const wsPmt = XLSXStyle.utils.aoa_to_sheet([
    Array(PMT_COLS.length).fill(''),
    Array(PMT_COLS.length).fill(''),
    Array(PMT_COLS.length).fill(''),
    PMT_COLS,
    ...pmtRows,
  ])
  wsPmt['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 32 }, { wch: 16 }]
  wsPmt['!rows'] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 6 }, { hpt: 22 }, ...pmtRows.map(() => ({ hpt: 18 }))]
  debtSheetHeader(wsPmt, 'LỊCH SỬ THANH TOÁN', subtitle, PMT_COLS.length, '4C1D95', '7C3AED')
  pmtRows.forEach((row, ri) => {
    const excelRow = 5 + ri
    const bg = ri % 2 === 0 ? 'FFFFFF' : 'F5F3FF'
    ;(row as unknown[]).forEach((_, ci) => {
      const addr = `${String.fromCharCode(65 + ci)}${excelRow}`
      const isMoney = ci === 2
      applyDebtStyle(wsPmt, addr, debtStyle(bg, isMoney ? '6D28D9' : '1E293B', isMoney, isMoney ? 'right' : ci === 1 ? 'center' : 'left', 10, true), isMoney ? '#,##0' : undefined)
    })
  })
  XLSXStyle.utils.book_append_sheet(wb, wsPmt, 'Lịch sử thanh toán')

  const filename = `agribridge-cong-no-${ledgerTab}-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSXStyle.writeFile(wb, filename)
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

function isCreditTermInvoice(invoice: SupplierDebtInvoice) {
  return String(invoice.paymentPlanType || '').toUpperCase() === 'CREDIT_TERM'
}

function isDepositInvoice(invoice: SupplierDebtInvoice) {
  const plan = String(invoice.paymentPlanType || '').toUpperCase()
  return plan === 'DEPOSIT_50' || plan === 'PARTIAL_PAYMENT'
}

function invoicesForLedger(invoices: SupplierDebtInvoice[], ledger: DebtLedgerTab) {
  return invoices.filter((invoice) => ledger === 'credit' ? isCreditTermInvoice(invoice) : isDepositInvoice(invoice))
}

function creditPolicyLabel(termDays?: number | null) {
  return termDays ? `Công nợ ${termDays} ngày` : 'Công nợ'
}

function creditLimitStatusLabel(status?: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'ACTIVE') return 'Đang áp dụng'
  if (normalized === 'SUSPENDED') return 'Tạm khóa'
  if (normalized === 'CLOSED') return 'Ngưng cấp'
  return emptyText
}

function hasCreditRelationship(item: SupplierDebtBuyer) {
  return Number(item.creditLimit || 0) > 0
    && [7, 15, 30].includes(Number(item.paymentTermDays || 0))
    && Boolean(String(item.creditStatus || '').trim())
    && String(item.creditStatus || '').toUpperCase() !== 'CHƯA CÓ'
    && String(item.creditStatus || '').toUpperCase() !== 'CLOSED'
}

function canSendReminder(invoice: SupplierDebtInvoice) {
  if (invoice.canSendReminder != null) return Boolean(invoice.canSendReminder)
  const status = (invoice.status || '').toUpperCase()
  return invoiceOutstandingAmount(invoice) > 0 && Boolean(invoice.confirmedReceivedAt) && status === 'OVERDUE'
}

function reminderBlockedLabel(invoice?: SupplierDebtInvoice | null) {
  if (!invoice) return 'Không có khoản cần nhắc'
  if (invoice.reminderBlockedReason) return invoice.reminderBlockedReason
  if (!invoice.confirmedReceivedAt) return 'Chờ nhận hàng'
  if ((invoice.status || '').toUpperCase() !== 'OVERDUE') return 'Chưa đến kỳ thanh toán'
  return 'Không đủ điều kiện nhắc nợ'
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
  const outstandingAmount = invoiceOutstandingAmount(invoice)
  if (status === 'OVERDUE' || Number(invoice.overdueDays || 0) > 0) return 'Quá hạn'
  if (outstandingAmount <= 0) return 'Đã thanh toán'
  if (status === 'DUE_NOW') return 'Đến hạn thanh toán'
  if (status === 'UNPAID') return 'Chưa thanh toán'
  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID') return 'Thanh toán một phần'
  if (status === 'PAID') return 'Đã thanh toán'
  return invoice.statusLabel || emptyText
}

type DebtSeverity = 'overdue' | 'dueSoon' | 'paid' | 'partial' | 'normal'

function dueDateValue(invoice: SupplierDebtInvoice) {
  return invoice.dueDate || invoice.expectedDueDate || invoice.confirmedReceivedAt
}

function daysUntil(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

function getDebtSeverity(invoice: SupplierDebtInvoice): DebtSeverity {
  const status = (invoice.status || '').toUpperCase()
  const outstandingAmount = invoiceOutstandingAmount(invoice)
  if (outstandingAmount <= 0 || status === 'PAID') return 'paid'
  if (status === 'OVERDUE' || Number(invoice.overdueDays || 0) > 0) return 'overdue'
  const dueIn = daysUntil(dueDateValue(invoice))
  if (dueIn != null && dueIn >= 0 && dueIn <= 3) return 'dueSoon'
  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID' || Number(invoice.paidAmount || 0) > 0) return 'partial'
  return 'normal'
}

function getBuyerDebtSeverity(item: SupplierDebtBuyer): DebtSeverity {
  if (Number(item.overdueAmount || 0) > 0 || item.status === 'OVERDUE') return 'overdue'
  if (Number(item.dueSoonAmount || 0) > 0 || item.status === 'DUE_SOON') return 'dueSoon'
  if (Number(item.remainingAmount || 0) <= 0) return 'paid'
  return 'partial'
}

function formatDebtStatus(invoice: SupplierDebtInvoice) {
  return invoiceStatusLabel(invoice)
}

function paymentProgressPercent(invoice: SupplierDebtInvoice) {
  const totalAmount = Math.max(Number(invoice.adjustedAmount ?? invoice.totalAmount ?? 0), 0)
  if (totalAmount <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((Number(invoice.paidAmount || 0) / totalAmount) * 100)))
}

function formatPaymentProgress(invoice: SupplierDebtInvoice) {
  const percent = paymentProgressPercent(invoice)
  if (percent <= 0) return 'Chưa thu'
  if (invoice.paymentPlanType === 'DEPOSIT_50' && percent >= 45 && percent <= 55 && invoiceOutstandingAmount(invoice) > 0) return 'Đã cọc 50%'
  if (invoiceOutstandingAmount(invoice) <= 0) return 'Đã thanh toán phần còn lại'
  return `Đã thanh toán ${percent}%`
}

function formatDueDate(invoice: SupplierDebtInvoice) {
  const label = dueDateLabel(invoice)
  const overdueDays = Number(invoice.overdueDays || 0)
  if (overdueDays > 0) return `${label} (Quá hạn ${overdueDays} ngày)`
  const dueIn = daysUntil(dueDateValue(invoice))
  if (dueIn === 0) return `${label} (Hôm nay)`
  if (dueIn != null && dueIn > 0 && dueIn <= 3) return `${label} (Còn ${dueIn} ngày)`
  return label
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
  if ((item.creditStatus || '').toUpperCase() === 'CLOSED') return 'Ngưng cấp'
  if ((item.creditStatus || '').toUpperCase() === 'SUSPENDED' || item.status === 'BLOCKED') return 'Tạm khóa'
  if (Number(item.overdueAmount || 0) > 0) return 'Quá hạn'
  if (Number(item.dueSoonAmount || 0) > 0) return 'Sắp đến hạn'
  if (Number(item.remainingAmount || 0) > 0) return 'Còn phải thu'
  return 'Đã tất toán'
}

function supplierCreditStatusLabel(item: SupplierDebtBuyer) {
  if ((item.creditStatus || '').toUpperCase() === 'CLOSED') return 'Ngưng cấp'
  if ((item.creditStatus || '').toUpperCase() === 'SUSPENDED' || item.status === 'BLOCKED') return 'Tạm khóa'
  return Number(item.creditLimit || 0) > 0 ? 'Đang áp dụng' : 'Chưa được cấp'
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
  | { type: 'limit'; buyer?: SupplierDebtBuyer }
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
  const [ledgerTab, setLedgerTab] = useState<DebtLedgerTab>('credit')
  const [exporting, setExporting] = useState(false)

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

  const refreshDebtState = useCallback(async () => {
    setBuyerDetailMap({})
    await loadDebts()
    if (detail?.summary.buyerId) {
      await openDetail(detail.summary.buyerId, activeTab)
    }
  }, [activeTab, detail?.summary.buyerId, loadDebts])

  useNotificationModuleRefresh(['DEBT', 'PAYMENT', 'CREDIT', 'REMINDER'], refreshDebtState)

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

  const ledgerBuyers = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return overview.buyers.filter((item) => {
      const ledgerInvoices = invoicesForLedger(buyerDetailMap[item.buyerId]?.invoices || [], ledgerTab)
      const outstandingLedgerInvoices = ledgerInvoices.filter(isOutstandingDebtInvoice)
      const hasLedgerDebt = ledgerTab === 'credit'
        ? hasCreditRelationship(item)
        : buyerDetailMap[item.buyerId]
          ? outstandingLedgerInvoices.length > 0
          : Number(item.remainingAmount || 0) > 0
      const matchesText = !text || item.buyerName.toLowerCase().includes(text)
      return hasLedgerDebt && matchesText
    })
  }, [buyerDetailMap, keyword, ledgerTab, overview.buyers])

  const buyers = useMemo(() => {
    return ledgerBuyers.filter((item) => {
      const ledgerInvoices = invoicesForLedger(buyerDetailMap[item.buyerId]?.invoices || [], ledgerTab)
      return status === 'all'
        ? true
        : (status === 'REMINDER' ? ledgerInvoices.some(canSendReminder) : item.status === status)
    })
  }, [buyerDetailMap, ledgerBuyers, ledgerTab, status])

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
    () => ledgerBuyers.filter((item) => invoicesForLedger(buyerDetailMap[item.buyerId]?.invoices || [], ledgerTab).some(canSendReminder)).length,
    [buyerDetailMap, ledgerBuyers, ledgerTab],
  )

  const ledgerStats = useMemo(() => {
    const details = Object.values(buyerDetailMap)
    return ledgerTab === 'credit'
      ? buildSupplierCreditStats(details)
      : buildSupplierDepositStats(details)
  }, [buyerDetailMap, ledgerTab])

  const tabs = [
    { key: 'all', label: 'Tất cả', count: ledgerBuyers.length },
    { key: 'OVERDUE', label: 'Quá hạn', count: ledgerBuyers.filter((item) => item.status === 'OVERDUE').length },
    { key: 'DUE_SOON', label: 'Sắp đến hạn', count: ledgerBuyers.filter((item) => item.status === 'DUE_SOON').length },
    { key: 'REMINDER', label: 'Khách cần nhắc', count: customerNeedReminderCount },
    { key: 'BLOCKED', label: 'Tạm khóa', count: ledgerBuyers.filter((item) => item.status === 'BLOCKED').length },
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
    if (detail?.summary.buyerId === buyerId) {
      setDetail(nextDetail ?? (await fetchSupplierDebtBuyerDetail(buyerId)))
    }
  }

  const handleExportReport = async () => {
    if (!buyers.length) {
      showToast('Không có dữ liệu công nợ để xuất báo cáo.', 'info')
      return
    }

    try {
      setExporting(true)
      // Fetch all buyer details
      const detailPairs = await Promise.all(
        buyers.map(async (buyer) => {
          const cached = buyerDetailMap[buyer.buyerId]
          if (cached) return [buyer.buyerId, cached] as const
          const loaded = await fetchSupplierDebtBuyerDetail(buyer.buyerId)
          return [buyer.buyerId, loaded] as const
        }),
      )
      const detailsByBuyer = Object.fromEntries(detailPairs) as Record<number, SupplierDebtBuyerDetail>
      setBuyerDetailMap((prev) => ({ ...prev, ...detailsByBuyer }))

      downloadDebtExcel({
        ledgerTab,
        buyers,
        detailsByBuyer,
        kpiStats: ledgerStats,
      })

      showToast('Đã xuất báo cáo công nợ Excel.', 'success')
    } catch (err) {
      console.error('[DebtExport] Lỗi:', err)
      showToast(
        err instanceof Error ? err.message : 'Không thể xuất báo cáo công nợ.',
        'error',
      )
    } finally {
      setExporting(false)
    }
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
            <DebtLedgerSegmentedToggle value={ledgerTab} onChange={(value) => { setLedgerTab(value); setStatus('all'); setActiveTab('invoices') }} />
            {ledgerTab === 'credit' ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                onClick={() => setModal({ type: 'limit' })}
              >
                <Settings className="h-3.5 w-3.5" />
                Cấp hạn mức
              </button>
            ) : null}
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleExportReport()}
              disabled={exporting || loading}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? 'Đang xuất...' : 'Xuất báo cáo'}
            </button>
          </div>
        }
      >
        {loading ? <Notice tone="emerald" text="Đang tải dữ liệu công nợ..." /> : null}
        {error ? <Notice tone="red" text={error} /> : null}

        {!loading && !error && ledgerStats.length > 0 ? (
          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {ledgerStats.map((item) => <DebtStatCardView key={item.id} stat={item} />)}
          </div>
        ) : null}

        <SupplierPanel>
          {!loading && !error && buyers.length === 0 ? (
            <Empty text="Hiện chưa có khoản cần thu." />
          ) : null}
          <div className="grid gap-3">
            {buyers.map((item) => {
              const detailByBuyer = buyerDetailMap[item.buyerId]
              const ledgerInvoices = invoicesForLedger(detailByBuyer?.invoices || [], ledgerTab)
              const outstandingInvoices = ledgerInvoices.filter(isOutstandingDebtInvoice)
              return (
                <SupplierDebtCard
                  key={item.buyerId}
                  buyer={item}
                  ledgerTab={ledgerTab}
                  invoices={outstandingInvoices}
                  invoiceCount={outstandingInvoices.length}
                  debtType={debtTypeLabelFromInvoices(outstandingInvoices, item.remainingAmount)}
                  reminderLabel={reminderColumnLabel(detailByBuyer?.reminders || [])}
                  canRemind={ledgerInvoices.some(canSendReminder)}
                  onOpen={() => void openDetail(item.buyerId, 'invoices')}
                  onReminder={() => setModal({ type: 'reminder', buyer: item })}
                  onLimit={() => ledgerTab === 'credit' ? setModal({ type: 'limit', buyer: item }) : undefined}
                />
              )
            })}
          </div>
        </SupplierPanel>
      </SupplierShell>

      {detailLoading ? <Overlay>Đang tải chi tiết...</Overlay> : null}
      {detail ? (
        <DetailDrawer
          detail={detail}
          ledgerTab={ledgerTab}
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
          setFocusInvoiceId={setFocusInvoiceId}
        />
      ) : null}

      {modal ? (
        <DebtActionModal
          modal={modal}
          detail={detail}
          ledgerTab={ledgerTab}
          buyers={overview.buyers}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setModal(null)}
          onDone={refreshAfterAction}
        />
      ) : null}
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

function countOrders(invoices: SupplierDebtInvoice[]) {
  const keys = new Set(invoices.map((invoice) => invoice.orderId ? `order-${invoice.orderId}` : `invoice-${invoice.invoiceId}`))
  return keys.size
}

function buildSupplierCreditStats(details: SupplierDebtBuyerDetail[]): DebtStatCard[] {
  const creditInvoices = details.flatMap((detail) => invoicesForLedger(detail.invoices, 'credit'))
  const outstandingInvoices = creditInvoices.filter(isOutstandingDebtInvoice)
  const overdueInvoices = outstandingInvoices.filter((invoice) => getDebtSeverity(invoice) === 'overdue')
  const dueSoonInvoices = outstandingInvoices.filter((invoice) => getDebtSeverity(invoice) === 'dueSoon')
  const creditInvoiceIds = new Set(creditInvoices.map((invoice) => invoice.invoiceId))
  const collectedThisMonth = details.flatMap((detail) => detail.payments)
    .filter((payment) => payment.invoiceId != null && creditInvoiceIds.has(payment.invoiceId) && isThisMonth(payment.paymentDate))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const customersNeedReminder = details.filter((detail) => invoicesForLedger(detail.invoices, 'credit').some(canSendReminder)).length

  return [
    { id: 'credit-receivable', label: 'Tổng phải thu công nợ', value: formatMoney(outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'credit-overdue', label: 'Quá hạn', value: formatMoney(overdueInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'credit-collected-month', label: 'Đã thu tháng này', value: formatMoney(collectedThisMonth) },
    { id: 'credit-due-soon', label: 'Sắp đến hạn', value: formatMoney(dueSoonInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'credit-invoices', label: 'Hóa đơn công nợ', value: formatNumber(outstandingInvoices.length) },
    { id: 'credit-reminders', label: 'Khách cần nhắc', value: formatNumber(customersNeedReminder) },
  ]
}

function buildSupplierDepositStats(details: SupplierDebtBuyerDetail[]): DebtStatCard[] {
  const depositInvoices = details.flatMap((detail) => invoicesForLedger(detail.invoices, 'deposit'))
  const outstandingInvoices = depositInvoices.filter(isOutstandingDebtInvoice)
  const upcomingDeliveryInvoices = outstandingInvoices.filter((invoice) => !invoice.confirmedReceivedAt)
  const overdueInvoices = outstandingInvoices.filter((invoice) => getDebtSeverity(invoice) === 'overdue')

  return [
    { id: 'deposit-collected', label: 'Tổng đã thu cọc', value: formatMoney(depositInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0)) },
    { id: 'deposit-remaining', label: 'Tổng còn phải thu', value: formatMoney(outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)) },
    { id: 'deposit-pending', label: 'Đơn chờ thanh toán phần còn lại', value: formatNumber(countOrders(outstandingInvoices)) },
    { id: 'deposit-delivery', label: 'Đơn sắp giao', value: formatNumber(countOrders(upcomingDeliveryInvoices)) },
    { id: 'deposit-overdue', label: 'Đơn quá hạn thanh toán', value: formatNumber(countOrders(overdueInvoices)) },
  ]
}

function DebtStatCardView({ stat }: { stat: DebtStatCard }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{stat.label}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{stat.value}</p>
    </div>
  )
}

function SupplierDebtCard({
  buyer,
  ledgerTab,
  invoices,
  invoiceCount,
  debtType,
  reminderLabel,
  canRemind,
  onOpen,
  onReminder,
  onLimit,
}: {
  buyer: SupplierDebtBuyer
  ledgerTab: DebtLedgerTab
  invoices: SupplierDebtInvoice[]
  invoiceCount: number
  debtType: string
  reminderLabel: string
  canRemind: boolean
  onOpen: () => void
  onReminder: () => void
  onLimit: () => void
}) {
  const creditRemainingAmount = invoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const creditOverdueAmount = invoices
    .filter((invoice) => getDebtSeverity(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const tabRemainingAmount = invoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const tabDueSoonAmount = invoices
    .filter((invoice) => getDebtSeverity(invoice) === 'dueSoon')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const severity = ledgerTab === 'credit'
    ? creditOverdueAmount > 0 ? 'overdue' : tabDueSoonAmount > 0 ? 'dueSoon' : creditRemainingAmount > 0 ? 'partial' : 'normal'
    : getBuyerDebtSeverity(buyer)
  const statusLabel = ledgerTab === 'credit'
    ? creditOverdueAmount > 0
      ? 'Quá hạn'
      : tabDueSoonAmount > 0
        ? 'Sắp đến hạn'
        : creditRemainingAmount > 0
          ? 'Còn phải thu'
          : supplierCreditStatusLabel(buyer)
    : supplierStatusLabel(buyer)
  const displayedRemainingAmount = ledgerTab === 'credit' ? creditRemainingAmount : tabRemainingAmount
  const accent: Record<DebtSeverity, string> = {
    overdue: 'border-l-rose-500 bg-rose-50/20 hover:border-rose-200',
    dueSoon: 'border-l-amber-400 bg-amber-50/20 hover:border-amber-200',
    paid: 'border-l-emerald-500 bg-emerald-50/20 hover:border-emerald-200',
    partial: 'border-l-sky-500 bg-sky-50/20 hover:border-sky-200',
    normal: 'border-l-slate-300 bg-white hover:border-slate-300',
  }
  return (
    <article
      className={`cursor-pointer rounded-2xl border border-slate-200 border-l-4 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent[severity]}`}
      onClick={onOpen}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,1.35fr)_minmax(360px,1.55fr)_auto] xl:items-center">
        <div className="min-w-0 border-b border-slate-100 pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <DebtSeverityBadge severity={severity} label={statusLabel} />
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{invoiceCount || 0} hóa đơn cần thu</span>
          </div>
          <h3 className="mt-3 truncate text-xl font-extrabold text-slate-950">{buyer.buyerName || emptyText}</h3>
          {ledgerTab === 'credit' ? (
            <div className="mt-1 space-y-1">
              <p className="text-sm font-extrabold text-emerald-700">{creditPolicyLabel(buyer.paymentTermDays)}</p>
              <p className="text-sm font-semibold text-slate-500">{supplierCreditStatusLabel(buyer)}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-500">{debtType} · {reminderLabel}</p>
          )}
        </div>

        {ledgerTab === 'credit' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DebtMetric label="Hạn mức còn" value={`${formatCurrency(buyer.remainingCredit)} / ${formatCurrency(buyer.creditLimit)}`} tone="slate" />
            <DebtMetric label="Đang nợ" value={formatCurrency(creditRemainingAmount)} tone={creditRemainingAmount > 0 ? 'amber' : 'slate'} />
            <DebtMetric label="Quá hạn" value={formatCurrency(creditOverdueAmount)} tone={creditOverdueAmount > 0 ? 'rose' : 'slate'} />
            <DebtMetric label="Hóa đơn cần thu" value={`${invoiceCount || 0}`} tone="slate" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <DebtMetric label="Sắp đến hạn" value={formatCurrency(tabDueSoonAmount)} tone={tabDueSoonAmount > 0 ? 'amber' : 'slate'} />
            <DebtMetric label="Còn phải thu" value={formatCurrency(tabRemainingAmount)} tone="slate" />
          </div>
        )}

        <div className="flex flex-col gap-4 xl:min-w-[360px] xl:items-end">
          <DebtAmount label="Còn phải thu" value={displayedRemainingAmount} severity={severity} align="right" />
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:justify-end">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={(event) => {
                event.stopPropagation()
                onOpen()
              }}
            >
              <FileText className="h-4 w-4" />
              Chi tiết
            </button>
            <DebtActionGroup
              className="mt-0"
              canPay={false}
              canRemind={canRemind}
              canAdjust={ledgerTab === 'credit'}
              onPayment={() => undefined}
              onReminder={onReminder}
              onAdjustment={onLimit}
              adjustmentLabel="Hạn mức"
              adjustmentIcon={<Settings className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function DetailDrawer({
  detail,
  ledgerTab,
  activeTab,
  setActiveTab,
  onClose,
  onPayment,
  onReminder,
  onLimit,
  onAdjustment,
  focusInvoiceId,
  setFocusInvoiceId,
}: {
  detail: SupplierDebtBuyerDetail
  ledgerTab: DebtLedgerTab
  activeTab: string
  setActiveTab: (tab: 'invoices' | 'payments' | 'adjustments' | 'reminders' | 'limit') => void
  onClose: () => void
  onPayment: (invoice?: SupplierDebtInvoice) => void
  onReminder: (invoice?: SupplierDebtInvoice) => void
  onLimit: () => void
  onAdjustment: (invoice?: SupplierDebtInvoice) => void
  focusInvoiceId?: number | null
  setFocusInvoiceId: (invoiceId: number | null) => void
}) {
  const ledgerInvoices = invoicesForLedger(detail.invoices, ledgerTab)
  const outstandingInvoices = ledgerInvoices.filter(isOutstandingDebtInvoice)
  const invoiceMap = new Map(detail.invoices.map((item) => [item.invoiceId, item]))
  const outstandingAmount = outstandingInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const overdueAmount = outstandingInvoices
    .filter((invoice) => (invoice.status || '').toUpperCase() === 'OVERDUE')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const paymentHistoryItems: PaymentHistoryItem[] = detail.payments.filter((item) => {
    const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
    return invoice ? (ledgerTab === 'credit' ? isCreditTermInvoice(invoice) : isDepositInvoice(invoice)) : false
  }).map((item) => {
    const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
    const orderCode = invoice?.orderCode || invoice?.orderRef
    const invoiceCode = invoice ? displayInvoiceCode(invoice) : item.invoiceId ? `INV-${item.invoiceId}` : emptyText
    const isDeposit = invoice?.paymentPlanType === 'DEPOSIT_50' && Number(item.amount || 0) > 0 && Number(item.amount || 0) <= Number(invoice.adjustedAmount || invoice.totalAmount || 0) / 2
    return {
      id: `payment-${item.paymentId}`,
      role: 'supplier' as const,
      amount: item.amount,
      status: isDeposit ? 'deposit' as const : Number(item.amount || 0) > 0 ? 'paid' as const : 'settled' as const,
      paymentMethod: item.paymentMethod,
      paymentDate: item.paymentDate,
      note: item.note,
      invoiceCode,
      orderCode,
      counterpartyName: detail.summary.buyerName,
      counterpartyLabel: 'Khách hàng',
      description: orderCode ? `Đối tác đã thanh toán cho đơn ${orderCode}.` : undefined,
      invoiceId: item.invoiceId,
      paymentId: item.paymentId,
      paymentPlanType: invoice?.paymentPlanType,
    }
  })
  const reminderItems = detail.reminders.filter((item) => {
    const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
    return invoice ? (ledgerTab === 'credit' ? isCreditTermInvoice(invoice) : isDepositInvoice(invoice)) : false
  }).map((item): DebtReminderCardItem => {
    const invoice = item.invoiceId ? invoiceMap.get(item.invoiceId) : undefined
    return {
      ...item,
      invoiceNumber: item.invoiceNumber || invoice?.invoiceNumber,
      orderId: item.orderId || invoice?.orderId,
      orderCode: item.orderCode || invoice?.orderCode || invoice?.orderRef,
      productName: item.productName || invoice?.productName,
      quantity: item.quantity ?? invoice?.quantity,
      unit: item.unit || invoice?.unit,
      dueDate: invoice?.dueDate || invoice?.expectedDueDate,
      dueLabel: item.dueLabel || invoice?.dueLabel,
      amount: item.amount ?? (invoice ? invoiceOutstandingAmount(invoice) : 0),
      invoiceStatus: invoice?.status,
      overdueDays: invoice?.overdueDays,
      outstandingAmount: invoice ? invoiceOutstandingAmount(invoice) : item.amount,
    }
  })
  const tabs = [
    ['invoices', 'Hóa đơn'],
    ['payments', 'Thanh toán công nợ'],
    ['adjustments', 'Điều chỉnh'],
    ['reminders', 'Nhắc nợ'],
    ...(ledgerTab === 'credit' ? [['limit', 'Hạn mức'] as const] : []),
  ] as const

  useEffect(() => {
    if (ledgerTab === 'deposit' && activeTab === 'limit') setActiveTab('invoices')
  }, [activeTab, ledgerTab, setActiveTab])

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
            <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Đóng">
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
          {activeTab === 'invoices' ? <InvoiceTab invoices={outstandingInvoices} showLimitAction={ledgerTab === 'credit'} onPayment={onPayment} onReminder={onReminder} onAdjustment={onAdjustment} focusInvoiceId={focusInvoiceId} /> : null}
          {activeTab === 'payments' ? (
            <PaymentTimelineGroup
              items={paymentHistoryItems}
              empty="Chưa có giao dịch thanh toán nào."
              onOpen={(item) => {
                setFocusInvoiceId(item.invoiceId || null)
                setActiveTab('invoices')
              }}
            />
          ) : null}
          {activeTab === 'adjustments' ? <Timeline items={detail.adjustments.map((item) => [`${formatMoney(item.amount)} - ${item.adjustmentType || emptyText}`, `Hóa đơn #${item.invoiceId} · ${formatDate(item.createdAt)}${item.description ? ` · ${item.description}` : ''}`])} empty="Chưa có điều chỉnh." /> : null}
          {activeTab === 'reminders' ? (
            <DebtReminderList
              items={reminderItems}
              role="supplier"
              counterpartyName={detail.summary.buyerName}
              empty="Bạn chưa gửi nhắc nợ nào cho khách hàng này."
              onOpen={(item) => {
                setFocusInvoiceId(item.invoiceId || null)
                setActiveTab('invoices')
              }}
            />
          ) : null}
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
              <Info label="Trạng thái" value={creditLimitStatusLabel(detail.creditLimit?.status)} />
              <button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white md:col-span-5" onClick={onLimit}>Thiết lập hạn mức</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function InvoiceTab({ invoices, showLimitAction, onPayment, onReminder, onAdjustment, focusInvoiceId }: { invoices: SupplierDebtInvoice[]; showLimitAction: boolean; onPayment: (invoice: SupplierDebtInvoice) => void; onReminder: (invoice: SupplierDebtInvoice) => void; onAdjustment: (invoice: SupplierDebtInvoice) => void; focusInvoiceId?: number | null }) {
  useEffect(() => {
    if (!focusInvoiceId) return
    document.getElementById(`supplier-debt-invoice-${focusInvoiceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusInvoiceId])
  if (!invoices.length) return <Empty text="Hiện chưa có khoản cần thu." />
  return (
    <div className="grid gap-3">
      {invoices.map((invoice) => (
        <SupplierInvoiceDebtCard
          key={invoice.invoiceId}
          invoice={invoice}
          focused={focusInvoiceId === invoice.invoiceId}
          showLimitAction={showLimitAction}
          onPayment={() => onPayment(invoice)}
          onReminder={() => onReminder(invoice)}
          onAdjustment={() => onAdjustment(invoice)}
        />
      ))}
    </div>
  )
}

function SupplierInvoiceDebtCard({
  invoice,
  focused,
  showLimitAction,
  onPayment,
  onReminder,
  onAdjustment,
}: {
  invoice: SupplierDebtInvoice
  focused?: boolean
  showLimitAction: boolean
  onPayment: () => void
  onReminder: () => void
  onAdjustment: () => void
}) {
  const severity = getDebtSeverity(invoice)
  const outstandingAmount = invoiceOutstandingAmount(invoice)
  const orderCode = invoice.orderCode || invoice.orderRef || `ORD-${invoice.orderId}`
  const canAdjust = !['PAID', 'CANCELLED', 'VOIDED'].includes((invoice.status || '').toUpperCase())
  const cardTone: Record<DebtSeverity, string> = {
    overdue: 'border-rose-200 bg-rose-50/35 ring-rose-100',
    dueSoon: 'border-amber-200 bg-amber-50/35 ring-amber-100',
    paid: 'border-emerald-200 bg-emerald-50/30 ring-emerald-100',
    partial: 'border-sky-200 bg-sky-50/30 ring-sky-100',
    normal: 'border-slate-200 bg-white ring-slate-100',
  }
  return (
    <article
      id={`supplier-debt-invoice-${invoice.invoiceId}`}
      className={`rounded-2xl border p-4 shadow-sm ring-1 ring-transparent transition ${cardTone[severity]} ${focused ? 'ring-2 ring-emerald-400' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DebtSeverityBadge severity={severity} label={formatDebtStatus(invoice)} />
            <span className="text-xs font-semibold text-slate-500">{displayInvoiceCode(invoice)}</span>
          </div>
          <h3 className="mt-2 truncate text-base font-extrabold text-slate-900">{orderCode}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{productSummary(invoice)}</p>
        </div>
        <DebtAmount label="Còn phải thu" value={outstandingAmount} severity={severity} align="right" />
      </div>

      <div className="mt-4 rounded-xl border border-white/70 bg-white/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Đã thu {formatCurrency(invoice.paidAmount)} / {formatCurrency(invoice.adjustedAmount ?? invoice.totalAmount)}</p>
          <p className="text-xs font-bold text-slate-700">{formatPaymentProgress(invoice)}</p>
        </div>
        <PaymentProgressBar percent={paymentProgressPercent(invoice)} severity={severity} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <DebtMetric label="Hạn thanh toán" value={formatDueDate(invoice)} tone={severity === 'overdue' ? 'rose' : severity === 'dueSoon' ? 'amber' : 'slate'} />
        <DebtMetric label="Tổng hóa đơn" value={formatCurrency(invoice.adjustedAmount ?? invoice.totalAmount)} tone="slate" />
      </div>

      <DebtActionGroup
        canPay={false}
        canRemind={outstandingAmount > 0}
        reminderDisabled={!canSendReminder(invoice)}
        reminderTitle={!canSendReminder(invoice) ? reminderBlockedLabel(invoice) : undefined}
        canAdjust={showLimitAction && canAdjust}
        onPayment={onPayment}
        onReminder={onReminder}
        onAdjustment={onAdjustment}
      />
    </article>
  )
}

function DebtSeverityBadge({ severity, label }: { severity: DebtSeverity; label: string }) {
  if (label === 'Tạm khóa') {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800">{label}</span>
  }
  if (label === 'Ngưng cấp') {
    return <span className="inline-flex rounded-full border border-rose-100 bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{label}</span>
  }
  const cls: Record<DebtSeverity, string> = {
    overdue: 'border-rose-200 bg-rose-100 text-rose-700',
    dueSoon: 'border-amber-200 bg-amber-100 text-amber-800',
    paid: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    partial: 'border-sky-200 bg-sky-100 text-sky-700',
    normal: 'border-slate-200 bg-slate-100 text-slate-700',
  }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${cls[severity]}`}>{label}</span>
}

type CreditRisk = 'low' | 'medium' | 'high'

function creditRiskLevel(item: SupplierDebtBuyer): { level: CreditRisk; label: string } {
  const overdueAmount = Number(item.overdueAmount || 0)
  const overdueInvoiceCount = Number(item.overdueInvoiceCount || 0)
  const overLimit = Number(item.creditLimit || 0) > 0 && (Number(item.usedCredit || 0) > Number(item.creditLimit || 0) || Number(item.remainingCredit || 0) < 0)
  if (item.status === 'BLOCKED' || item.status === 'OVER_LIMIT' || overLimit || overdueAmount > 0) return { level: 'high', label: 'Cao' }
  if (overdueInvoiceCount > 0 || Number(item.dueSoonAmount || 0) > 0 || Number(item.remainingAmount || 0) > 0) return { level: 'medium', label: 'Trung bình' }
  return { level: 'low', label: 'Thấp' }
}

function CreditLimitSummary({
  remainingAmount,
  overdueAmount,
  overdueInvoiceCount,
  risk,
}: {
  remainingAmount: number
  overdueAmount: number
  overdueInvoiceCount: number
  risk: { level: CreditRisk; label: string }
}) {
  const statusText: Record<CreditRisk, string> = {
    low: 'Thanh toán đúng hạn',
    medium: 'Chưa hoàn tất thanh toán đúng hạn',
    high: 'Đối tác đang chậm thanh toán',
  }
  const statusClass = risk.level === 'high' ? 'text-amber-700' : risk.level === 'medium' ? 'text-slate-700' : 'text-emerald-700'

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-slate-100 py-2 text-xs text-slate-500">
      <span>Đang nợ: <strong className="font-bold text-slate-900">{formatMoney(remainingAmount)}</strong></span>
      <span className="text-slate-300">•</span>
      <span>Quá hạn: <strong className={`font-bold ${overdueAmount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{formatMoney(overdueAmount)}</strong></span>
      <span className="text-slate-300">•</span>
      <span>Hóa đơn quá hạn: <strong className={`font-bold ${overdueInvoiceCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{overdueInvoiceCount}</strong></span>
      <div className="ml-auto flex items-center gap-1.5 font-semibold">
        {risk.level === 'high' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : null}
        <span className={statusClass}>{statusText[risk.level]}</span>
      </div>
    </section>
  )
}

function PaymentProgressBar({ percent, severity }: { percent: number; severity: DebtSeverity }) {
  const cls: Record<DebtSeverity, string> = {
    overdue: 'bg-rose-500',
    dueSoon: 'bg-amber-400',
    paid: 'bg-emerald-500',
    partial: 'bg-sky-500',
    normal: 'bg-slate-400',
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${cls[severity]}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-extrabold text-slate-700">{percent}%</span>
    </div>
  )
}

function DebtAmount({ label, value, severity, align = 'left' }: { label: string; value?: number | null; severity: DebtSeverity; align?: 'left' | 'right' }) {
  const cls: Record<DebtSeverity, string> = {
    overdue: 'text-rose-700',
    dueSoon: 'text-amber-700',
    paid: 'text-emerald-700',
    partial: 'text-sky-700',
    normal: 'text-slate-900',
  }
  return (
    <div className={align === 'right' ? 'text-left sm:text-right' : 'text-left'}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-xl font-black ${cls[severity]}`}>{formatCurrency(value)}</p>
    </div>
  )
}

function DebtMetric({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'amber' | 'rose' }) {
  const cls = {
    slate: 'border-slate-100 bg-slate-50 text-slate-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
  }[tone]
  return (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold">{value}</p>
    </div>
  )
}

function DebtActionGroup({
  className = 'mt-4',
  canPay,
  canRemind,
  canAdjust,
  reminderDisabled,
  reminderTitle,
  adjustmentLabel = 'Điều chỉnh',
  adjustmentIcon = <SlidersHorizontal className="h-4 w-4" />,
  onPayment,
  onReminder,
  onAdjustment,
}: {
  className?: string
  canPay: boolean
  canRemind: boolean
  canAdjust: boolean
  reminderDisabled?: boolean
  reminderTitle?: string
  adjustmentLabel?: string
  adjustmentIcon?: ReactElement
  onPayment: () => void
  onReminder: () => void
  onAdjustment: () => void
}) {
  return (
    <div className={`${className} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end`}>
      <div className="flex flex-wrap gap-2">
        {canRemind ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation()
              onReminder()
            }}
            disabled={reminderDisabled}
            title={reminderTitle}
          >
            <Bell className="h-4 w-4" />
            Nhắc nợ
          </button>
        ) : null}
        {canAdjust ? (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation()
              onAdjustment()
            }}
          >
            {adjustmentIcon}
            {adjustmentLabel}
          </button>
        ) : null}
      </div>
      {canPay ? (
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700"
          onClick={(event) => {
            event.stopPropagation()
            onPayment()
          }}
        >
          <CreditCard className="h-4 w-4" />
          Ghi nhận thu
        </button>
      ) : null}
    </div>
  )
}

function DebtActionModal({ modal, detail, ledgerTab, buyers, saving, setSaving, onClose, onDone }: { modal: NonNullable<ModalState>; detail: SupplierDebtBuyerDetail | null; ledgerTab: DebtLedgerTab; buyers: SupplierDebtBuyer[]; saving: boolean; setSaving: (value: boolean) => void; onClose: () => void; onDone: (buyerId: number, detail?: SupplierDebtBuyerDetail) => Promise<void> }) {
  const { showToast } = useToast()
  const [limitBuyerId, setLimitBuyerId] = useState(modal.type === 'limit' && modal.buyer ? String(modal.buyer.buyerId) : '')
  const selectedLimitBuyer = modal.type === 'limit' && limitBuyerId ? buyers.find((item) => String(item.buyerId) === limitBuyerId) : undefined
  const activeBuyer = modal.type === 'limit' ? (selectedLimitBuyer ?? modal.buyer ?? null) : modal.buyer
  const activeBuyerId = activeBuyer?.buyerId ?? 0
  const [buyerInvoices, setBuyerInvoices] = useState<SupplierDebtInvoice[]>(activeBuyer && detail?.summary.buyerId === activeBuyer.buyerId ? detail.invoices : [])
  const invoices = invoicesForLedger(buyerInvoices, ledgerTab).filter(modal.type === 'reminder' ? canSendReminder : isOutstandingDebtInvoice)
  const firstInvoice = 'invoice' in modal ? modal.invoice ?? invoices[0] : invoices[0]
  const [invoiceId, setInvoiceId] = useState(firstInvoice ? String(firstInvoice.invoiceId) : '')
  const selectedInvoice = invoices.find((item) => String(item.invoiceId) === invoiceId) ?? firstInvoice
  const [amount, setAmount] = useState(String(selectedInvoice ? invoiceOutstandingAmount(selectedInvoice) : (activeBuyer?.remainingAmount ?? 0)))
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [date, setDate] = useState(todayInput())
  const [term, setTerm] = useState(String(activeBuyer?.paymentTermDays ?? 15))
  const [limit, setLimit] = useState(formatMoneyInput(activeBuyer?.creditLimit ?? 0))
  const [status, setStatus] = useState<CreditLimitUiStatus>(() => {
    const creditStatus = (activeBuyer?.creditStatus || '').toUpperCase()
    if (creditStatus === 'SUSPENDED') return 'SUSPENDED'
    if (creditStatus === 'INACTIVE' || creditStatus === 'CLOSED') return 'CLOSED'
    return 'ACTIVE'
  })
  const [type, setType] = useState('SHORT_DELIVERY')
  const [note, setNote] = useState('')
  const [sendSystemNotification, setSendSystemNotification] = useState(true)
  const [markOnBuyerDebtPage, setMarkOnBuyerDebtPage] = useState(true)
  const selectedOutstandingAmount = selectedInvoice ? invoiceOutstandingAmount(selectedInvoice) : 0
  const isReminderAmountInvalid = modal.type === 'reminder' && (!selectedInvoice || selectedOutstandingAmount <= 0 || !canSendReminder(selectedInvoice))
  const limitAmount = parseMoneyInput(limit)
  const buyerSummary = activeBuyer && detail?.summary.buyerId === activeBuyer.buyerId ? detail.summary : activeBuyer
  const limitInvoices = invoicesForLedger(buyerInvoices, 'credit').filter(isOutstandingDebtInvoice)
  const overdueAmount = limitInvoices
    .filter((invoice) => getDebtSeverity(invoice) === 'overdue')
    .reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const overdueInvoiceCount = limitInvoices.filter((invoice) => getDebtSeverity(invoice) === 'overdue').length
  const remainingAmount = limitInvoices.reduce((sum, invoice) => sum + invoiceOutstandingAmount(invoice), 0)
  const usedCredit = Number(buyerSummary?.usedCredit || 0)
  const isOverLimit = Number(buyerSummary?.creditLimit || 0) > 0 && (usedCredit > Number(buyerSummary?.creditLimit || 0) || Number(buyerSummary?.remainingCredit || 0) < 0)
  const hasLimitRisk = modal.type === 'limit' && (overdueAmount > 0 || overdueInvoiceCount > 0 || isOverLimit || buyerSummary?.status === 'BLOCKED')
  const isLimitInvalid = modal.type === 'limit' && (limitAmount < 0 || (status === 'ACTIVE' && limitAmount <= 0))
  const limitValidationMessage = modal.type === 'limit' && status === 'ACTIVE' && limitAmount <= 0 ? 'Hạn mức đang áp dụng phải lớn hơn 0đ.' : ''

  useEffect(() => {
    let cancelled = false
    const loadInvoices = async () => {
      if (!activeBuyerId) {
        setBuyerInvoices([])
        return
      }
      if (detail?.summary.buyerId === activeBuyerId) {
        setBuyerInvoices(detail.invoices)
        return
      }
      try {
        const buyerDetail = await fetchSupplierDebtBuyerDetail(activeBuyerId)
        if (!cancelled) setBuyerInvoices(buyerDetail.invoices || [])
      } catch {
        if (!cancelled) setBuyerInvoices([])
      }
    }
    void loadInvoices()
    return () => {
      cancelled = true
    }
  }, [activeBuyerId, detail?.summary.buyerId])

  useEffect(() => {
    if (modal.type !== 'limit' || !selectedLimitBuyer) return
    setTerm(String(selectedLimitBuyer.paymentTermDays ?? 15))
    setLimit(formatMoneyInput(selectedLimitBuyer.creditLimit ?? 0))
    const creditStatus = (selectedLimitBuyer.creditStatus || '').toUpperCase()
    setStatus(creditStatus === 'SUSPENDED' ? 'SUSPENDED' : creditStatus === 'INACTIVE' || creditStatus === 'CLOSED' ? 'CLOSED' : 'ACTIVE')
  }, [modal.type, selectedLimitBuyer?.buyerId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

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
        if (!activeBuyer || !selectedInvoice || parsed <= 0) throw new Error('Vui lòng chọn hóa đơn và số tiền hợp lệ.')
        const next = await createSupplierDebtPayment({ buyerId: activeBuyer.buyerId, amount: parsed, paymentMethod: method, paymentDate: new Date(date).toISOString(), note: note || undefined, allocations: [{ invoiceId: selectedInvoice.invoiceId, amount: parsed }] })
        await onDone(activeBuyer.buyerId, next)
      } else if (modal.type === 'limit') {
        if (!activeBuyer) throw new Error('Vui lòng chọn đối tác để cấp hạn mức.')
        if (isLimitInvalid) throw new Error(limitValidationMessage || 'Vui lòng nhập hạn mức hợp lệ.')
        const backendStatus = status
        const backendLimit = status === 'CLOSED' ? 0 : limitAmount
        await saveSupplierCreditLimit({ buyerId: activeBuyer.buyerId, creditLimit: backendLimit, paymentTermDays: Number(term), status: backendStatus, note: note || undefined })
        await onDone(activeBuyer.buyerId)
      } else if (modal.type === 'adjustment') {
        if (!activeBuyer || !selectedInvoice) throw new Error('Vui lòng chọn hóa đơn.')
        const next = await createSupplierDebtAdjustment({ invoiceId: selectedInvoice.invoiceId, amount: Number(amount), adjustmentType: type, description: note || undefined })
        await onDone(activeBuyer.buyerId, next)
      } else {
        if (!activeBuyer || !selectedInvoice) throw new Error('Vui lòng chọn hóa đơn cần nhắc nợ.')
        if (isReminderAmountInvalid) throw new Error(reminderBlockedLabel(selectedInvoice))
        const next = await createSupplierDebtReminder({
          buyerId: activeBuyer.buyerId,
          invoiceId: selectedInvoice.invoiceId,
          amount: selectedOutstandingAmount,
          message: note || undefined,
          channel: 'NOTIFICATION',
          sendSystemNotification,
          markOnBuyerDebtPage,
        })
        await onDone(activeBuyer.buyerId, next)
      }
      showToast(
        modal.type === 'limit'
          ? status === 'ACTIVE'
            ? 'Đã cập nhật hạn mức công nợ. Đối tác hiện có thể sử dụng phương thức thanh toán công nợ.'
            : status === 'SUSPENDED'
              ? 'Đã tạm khóa công nợ. Đối tác vẫn có thể thanh toán các khoản hiện tại.'
              : 'Đã ngưng cấp công nợ. Hạn mức đã được đặt về 0đ.'
          : modal.type === 'reminder'
            ? 'Đã gửi nhắc nợ cho đối tác'
            : 'Đã cập nhật công nợ.',
        'success',
      )
    } catch (requestError) {
      showToast(readApiErrorMessage(requestError) || (requestError instanceof Error ? requestError.message : 'Không thể cập nhật công nợ.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !saving && !isReminderAmountInvalid && !isLimitInvalid && (modal.type !== 'limit' || Boolean(activeBuyer))

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <form
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${modal.type === 'limit' ? 'max-w-[720px]' : 'max-w-[620px]'}`}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) void submit()
        }}
      >
        <div className={`flex-shrink-0 border-b border-slate-100 ${modal.type === 'limit' ? 'px-5 py-4 sm:px-6' : 'px-5 py-4'}`}>
          {modal.type === 'limit' ? (
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold leading-tight text-slate-950">Thiết lập hạn mức công nợ</h3>
              <p className="mt-1 text-sm leading-5 text-slate-500">Quản lý hạn mức và kỳ hạn công nợ cho đối tác.</p>
            </div>
          ) : (
            <h3 className="text-lg font-extrabold text-slate-900">{modalTitle(modal.type)}</h3>
          )}
        </div>
        <div className={`overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${modal.type === 'limit' ? 'max-h-[calc(88vh-136px)] space-y-4 px-5 py-4 sm:px-6' : 'max-h-[calc(80vh-140px)] space-y-3 px-5 py-4'}`}>
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
              <label className="block text-sm font-bold text-slate-800">
                Đối tác
                <select
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
                  value={limitBuyerId}
                  onChange={(event) => setLimitBuyerId(event.target.value)}
                >
                  <option value="">Chọn đối tác</option>
                  {buyers.map((item) => (
                    <option key={item.buyerId} value={item.buyerId}>
                      {item.buyerName || `Đối tác #${item.buyerId}`}
                    </option>
                  ))}
                </select>
              </label>
              <CreditLimitSummary
                remainingAmount={remainingAmount}
                overdueAmount={overdueAmount}
                overdueInvoiceCount={overdueInvoiceCount}
                risk={buyerSummary ? creditRiskLevel(buyerSummary) : { level: 'low', label: 'Thấp' }}
              />
              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="supplier-credit-limit" className="text-sm font-extrabold text-slate-900">Hạn mức công nợ</label>
                    <span className="group relative inline-flex text-slate-400">
                      <CircleHelp className="h-4 w-4" />
                      <span className="pointer-events-none absolute right-0 top-6 z-10 hidden w-56 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold leading-5 text-white shadow-lg group-hover:block">
                        Số dư công nợ tối đa đối tác được phép mua trước và thanh toán sau.
                      </span>
                    </span>
                  </div>
                  <div className={`mt-3 flex items-end rounded-xl border bg-white px-4 py-4 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-50 ${limitValidationMessage ? 'border-rose-200' : 'border-slate-200'}`}>
                    <input
                      id="supplier-credit-limit"
                      className="w-full bg-transparent text-3xl font-black leading-none text-slate-950 outline-none placeholder:text-base placeholder:font-semibold placeholder:text-slate-400 sm:text-4xl"
                      inputMode="numeric"
                      placeholder="Nhập hạn mức"
                      value={limit}
                      onChange={(event) => setLimit(formatMoneyInput(event.target.value))}
                      autoFocus
                    />
                    <span className="ml-3 whitespace-nowrap pb-1 text-[11px] font-bold uppercase text-slate-500">VND</span>
                  </div>
                  {limitValidationMessage ? <p className="mt-2 text-xs font-semibold text-rose-600">{limitValidationMessage}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[5000000, 10000000, 20000000, 50000000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => setLimit(formatMoneyInput(preset))}
                      >
                        {preset / 1000000} triệu
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-800">
                    Kỳ hạn công nợ
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50" value={term} onChange={(event) => setTerm(event.target.value)}>
                      <option value="7">Công nợ 7 ngày</option>
                      <option value="15">Công nợ 15 ngày</option>
                      <option value="30">Công nợ 30 ngày</option>
                    </select>
                  </label>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Trạng thái</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                      {creditLimitStatusOptions.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          className={`min-h-9 rounded-lg px-2 text-xs font-bold transition ${status === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          onClick={() => setStatus(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {status === 'ACTIVE'
                        ? 'Đối tác có thể tạo đơn bằng công nợ khi còn đủ hạn mức.'
                        : status === 'SUSPENDED'
                          ? 'Tạm khóa giữ nguyên hạn mức và kỳ hạn, chỉ khóa tạo công nợ mới.'
                          : 'Ngưng cấp sẽ đặt hạn mức về 0đ và kết thúc quan hệ công nợ mới.'}
                    </p>
                  </div>
                </div>
              </div>
              {hasLimitRisk ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">Đối tác có công nợ quá hạn.</p>
                      <p className="mt-0.5 text-amber-800">Nên rà soát trước khi tăng hạn mức.</p>
                    </div>
                  </div>
                </div>
              ) : null}
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
          <label className={`block text-xs font-bold text-slate-600 ${modal.type === 'limit' ? 'text-sm text-slate-800' : ''}`}>{modal.type === 'reminder' ? 'Nội dung gửi đối tác' : 'Ghi chú'}<textarea className={`mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 ${modal.type === 'limit' ? 'h-16' : 'h-28'}`} rows={modal.type === 'limit' ? 2 : undefined} placeholder={modal.type === 'limit' ? 'Ghi chú nội bộ về hạn mức hoặc kỳ hạn công nợ...' : undefined} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          {modal.type === 'reminder' ? (
            <>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={sendSystemNotification} onChange={(event) => setSendSystemNotification(event.target.checked)} />Gửi thông báo cho đối tác</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={markOnBuyerDebtPage} onChange={(event) => setMarkOnBuyerDebtPage(event.target.checked)} />Đánh dấu hóa đơn đã nhắc</label>
              <p className="text-xs text-slate-500">Đối tác sẽ nhận thông báo công nợ và khoản này được cập nhật trạng thái đã nhắc.</p>
            </>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {modal.type === 'limit' ? <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" onClick={onClose} disabled={saving}>Hủy</button> : null}
          <button type="submit" className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSubmit}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? 'Đang cập nhật...' : modal.type === 'limit' ? 'Cập nhật hạn mức' : modal.type === 'reminder' ? 'Gửi nhắc nợ' : 'Lưu'}</button>
        </div>
      </form>
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

function Overlay({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-[85] bg-black/30 p-4"><div className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-4 text-sm font-semibold text-emerald-700">{children}</div></div>
}


