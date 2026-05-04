import { Send, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Client } from '@stomp/stompjs'
import {
  createSupplierQuote,
  fetchSupplierQuoteContext,
  rejectSupplierRfq,
  type SupplierQuoteContext,
} from '../../services/supplierService'
import { createRfqChatClient, fetchRfqMessages, sendRfqMessage } from '../../services/rfqChatService'
import { SearchInput, FilterTabBar, SupplierPanel, SupplierStatusPill } from '../../components/supplier/SupplierCommon'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useSupplierDashboardData } from './useSupplierDashboardData'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import type { RfqMessage } from '../../types/rfqChat'
import type { RfqItem } from '../../types/supplierDashboard'

type RfqTabKey = 'all' | 'pending' | 'quoted' | 'accepted' | 'rejected'
type QuoteStatusCode = 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'SENT' | 'DRAFT'

function parseRfqId(value?: string): number | null {
  if (!value) return null
  const rawId = value.startsWith('RFQ-') ? value.slice(4) : value
  const parsed = Number(rawId)
  return Number.isFinite(parsed) ? parsed : null
}

function stripToNumeric(value: string): string {
  return value.replace(/[^\d.]/g, '')
}

function formatDecimalInput(value: string): string {
  const cleaned = stripToNumeric(value)
  if (!cleaned) return ''

  const [whole, decimal] = cleaned.split('.')
  const formattedWhole = whole ? Number(whole).toLocaleString('en-US') : '0'
  return decimal !== undefined ? `${formattedWhole}.${decimal.slice(0, 2)}` : formattedWhole
}

function extractQuantityValue(raw?: string): string {
  if (!raw) return ''
  const matched = raw.match(/[\d.,]+/)
  return matched ? matched[0].replace(/,/g, '') : ''
}

function appendUniqueMessage(messages: RfqMessage[], nextMessage: RfqMessage): RfqMessage[] {
  if (messages.some((message) => message.id === nextMessage.id)) {
    return messages
  }

  return [...messages, nextMessage]
}

function formatChatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A'
  }

  return value.toLocaleString('vi-VN')
}

function formatDate(value?: string | null): string {
  if (!value) {
    return 'N/A'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('vi-VN')
}

function normalizeQuoteStatus(rfq: RfqItem): QuoteStatusCode | null {
  const status = rfq.quoteStatus?.trim().toUpperCase()
  if (!status) {
    return null
  }
  return status as QuoteStatusCode
}

function isQuoteTerminal(rfq: RfqItem): boolean {
  const status = normalizeQuoteStatus(rfq)
  return status === 'ACCEPTED' || status === 'APPROVED' || status === 'REJECTED'
}

function canChangeQuote(rfq: RfqItem): boolean {
  const status = normalizeQuoteStatus(rfq)
  return !rfq.hasExistingQuote || status === null || status === 'PENDING' || status === 'SENT' || status === 'DRAFT'
}

function quoteBadgeLabel(rfq: RfqItem): string {
  const status = normalizeQuoteStatus(rfq)
  if (status === 'ACCEPTED' || status === 'APPROVED') {
    return 'Đã chấp nhận'
  }
  if (status === 'REJECTED') {
    return 'Đã từ chối'
  }
  if (rfq.hasExistingQuote) {
    return 'Đã báo giá'
  }
  return 'Chờ báo giá'
}

export function SupplierRfqQuotesPage() {
  usePageTitle('Yêu cầu báo giá')
  const { data, loading, error, reload } = useSupplierDashboardData()
  const { showToast, showConfirm } = useToast()
  const rfqItems = data?.rfqItems ?? []
  const [openQuote, setOpenQuote] = useState(false)
  const [openChat, setOpenChat] = useState(false)
  const [activeTab, setActiveTab] = useState<RfqTabKey>('all')
  const [activeRfqId, setActiveRfqId] = useState(rfqItems[0]?.id ?? '')
  const [priceInput, setPriceInput] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [deliveryDaysInput, setDeliveryDaysInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [quoteContext, setQuoteContext] = useState<SupplierQuoteContext | null>(null)
  const [quoteContextLoading, setQuoteContextLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [chatMessages, setChatMessages] = useState<RfqMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatConnected, setChatConnected] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const chatClientRef = useRef<Client | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const statusCount = {
    pending: rfqItems.filter((item) => item.status === 'Chờ báo giá').length,
    quoted: rfqItems.filter((item) => item.status === 'Đã báo giá').length,
    accepted: rfqItems.filter((item) => item.status === 'Chấp nhận').length,
    rejected: rfqItems.filter((item) => item.status === 'Từ chối').length,
  }

  const filteredRfqItems = useMemo(() => {
    let items = rfqItems
    switch (activeTab) {
      case 'pending': items = rfqItems.filter((item) => item.status === 'Chờ báo giá'); break
      case 'quoted': items = rfqItems.filter((item) => item.status === 'Đã báo giá'); break
      case 'accepted': items = rfqItems.filter((item) => item.status === 'Chấp nhận'); break
      case 'rejected': items = rfqItems.filter((item) => item.status === 'Từ chối'); break
      default: break
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      items = items.filter((item) =>
        item.id.toLowerCase().includes(kw) ||
        item.customer.toLowerCase().includes(kw) ||
        item.product.toLowerCase().includes(kw)
      )
    }
    return items
  }, [activeTab, rfqItems, searchKeyword])

  const activeRfq = filteredRfqItems.find((item) => item.id === activeRfqId)
    ?? rfqItems.find((item) => item.id === activeRfqId)
    ?? filteredRfqItems[0]
    ?? rfqItems[0]
  const availableBatches = quoteContext?.batches ?? []
  const quoteUnit = quoteContext?.rfq.unit || activeRfq?.unit || 'kg'

  const tabs: Array<{ key: RfqTabKey; label: string; count: number }> = [
    { key: 'all', label: 'Tất cả', count: rfqItems.length },
    { key: 'pending', label: 'Chờ báo giá', count: statusCount.pending },
    { key: 'quoted', label: 'Đã báo giá', count: statusCount.quoted },
    { key: 'accepted', label: 'Chấp nhận', count: statusCount.accepted },
    { key: 'rejected', label: 'Từ chối', count: statusCount.rejected },
  ]

  useEffect(() => {
    if (!activeRfqId && filteredRfqItems[0]) {
      setActiveRfqId(filteredRfqItems[0].id)
      return
    }

    if (activeRfqId && filteredRfqItems.length > 0 && !filteredRfqItems.some((item) => item.id === activeRfqId)) {
      setActiveRfqId(filteredRfqItems[0].id)
    }
  }, [activeRfqId, filteredRfqItems])

  useEffect(() => {
    if (!openQuote || !activeRfq) {
      if (!openQuote) {
        setPriceInput('')
        setQuantityInput('')
        setDeliveryDaysInput('')
        setNoteInput('')
        setSelectedBatchId('')
        setQuoteContext(null)
        setQuoteContextLoading(false)
      }
      return
    }

    setPriceInput(
      activeRfq.hasExistingQuote && activeRfq.supplierQuotedPrice !== 'Chưa báo giá'
        ? formatDecimalInput(activeRfq.supplierQuotedPrice)
        : '',
    )
    setQuantityInput(extractQuantityValue(activeRfq.quantity))
    setDeliveryDaysInput(
      activeRfq.hasExistingQuote && activeRfq.supplierDeliveryDays !== null
        ? String(activeRfq.supplierDeliveryDays)
        : '',
    )
    setNoteInput(activeRfq.hasExistingQuote ? activeRfq.supplierQuoteNote : '')
    setSelectedBatchId('')
  }, [openQuote, activeRfq])

  useEffect(() => {
    if (!openQuote || !activeRfq) {
      return
    }

    const parsedRfqId = parseRfqId(activeRfq.id)
    if (!parsedRfqId) {
      showToast('Không xác định được RFQ để tải thông tin lô.', 'error')
      return
    }

    let cancelled = false
    setQuoteContextLoading(true)
    setQuoteContext(null)

    void fetchSupplierQuoteContext(parsedRfqId)
      .then((context) => {
        if (!cancelled) {
          setQuoteContext(context)
          if (!activeRfq.hasExistingQuote && context.rfq.quantity !== null && context.rfq.quantity !== undefined) {
            setQuantityInput(formatDecimalInput(String(context.rfq.quantity)))
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(readApiErrorMessage(error) || 'Không thể tải danh sách lô hiện có.', 'error')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQuoteContextLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeRfq, openQuote, showToast])

  useEffect(() => {
    if (!openChat) {
      setChatInput('')
      setChatMessages([])
      setChatConnected(false)
      return
    }

    const parsedRfqId = parseRfqId(activeRfqId)
    if (!parsedRfqId) {
      showToast('Không xác định được RFQ để mở chat.', 'error')
      setOpenChat(false)
      return
    }

    let cancelled = false
    setChatLoading(true)
    setChatConnected(false)

    void fetchRfqMessages(parsedRfqId)
      .then((messages) => {
        if (!cancelled) {
          setChatMessages(messages)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(readApiErrorMessage(error) || 'Không thể tải lịch sử chat.', 'error')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChatLoading(false)
        }
      })

    const client = createRfqChatClient(
      parsedRfqId,
      (message) => setChatMessages((prev) => appendUniqueMessage(prev, message)),
      (message) => showToast(message, 'error'),
      () => setChatConnected(true),
    )
    chatClientRef.current = client
    client.activate()

    return () => {
      cancelled = true
      setChatConnected(false)
      void client.deactivate()
      if (chatClientRef.current === client) {
        chatClientRef.current = null
      }
    }
  }, [activeRfqId, openChat, showToast])

  useEffect(() => {
    if (openChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, openChat])

  const handleOpenQuote = (rfqId: string) => {
    const rfq = rfqItems.find((item) => item.id === rfqId)
    if (rfq && isQuoteTerminal(rfq)) {
      showToast('Không thể sửa báo giá đã được chấp nhận hoặc từ chối.', 'error')
      return
    }

    setActiveRfqId(rfqId)
    setOpenQuote(true)
  }

  const handleSendChatMessage = () => {
    const parsedRfqId = parseRfqId(activeRfqId)
    const senderUserId = Number(sessionStorage.getItem('agribridge.auth.userId'))
    const senderCompanyId = Number(sessionStorage.getItem('agribridge.auth.companyId'))
    const message = chatInput.trim()

    if (!message) {
      return
    }

    if (!parsedRfqId || !Number.isFinite(senderUserId) || senderUserId <= 0 || !Number.isFinite(senderCompanyId) || senderCompanyId <= 0) {
      showToast('Không xác định được tài khoản để gửi chat.', 'error')
      return
    }

    const client = chatClientRef.current
    if (!client?.connected) {
      showToast('Chat realtime chưa kết nối, vui lòng thử lại sau.', 'error')
      return
    }

    sendRfqMessage(client, {
      rfqId: parsedRfqId,
      senderUserId,
      senderCompanyId,
      senderRole: 'SUPPLIER',
      message,
    })
    setChatInput('')
  }

  const handleReject = async (rfqId: string) => {
    const rfq = rfqItems.find((item) => item.id === rfqId)
    if (rfq && isQuoteTerminal(rfq)) {
      showToast('Không thể từ chối lại báo giá đã được chấp nhận hoặc từ chối.', 'error')
      return
    }

    const parsedRfqId = parseRfqId(rfqId)
    const companyId = Number(sessionStorage.getItem('agribridge.auth.companyId'))

    if (!parsedRfqId || !Number.isFinite(companyId) || companyId <= 0) {
      showToast('Không xác định được RFQ hoặc tài khoản nhà cung cấp.', 'error')
      return
    }

    const confirmed = await showConfirm('Bạn có chắc muốn từ chối RFQ này không?', {
      title: 'Xác nhận từ chối RFQ',
      confirmText: 'Từ chối',
      cancelText: 'Hủy',
    })
    if (!confirmed) {
      return
    }

    try {
      setSubmitting(true)
      await rejectSupplierRfq(parsedRfqId, { supplierCompanyId: companyId })
      reload()
      showToast(`Đã từ chối ${rfqId}.`, 'success')
    } catch (error) {
      showToast(readApiErrorMessage(error) || 'Không thể từ chối RFQ. Vui lòng thử lại.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId)
    const batch = availableBatches.find((item) => String(item.id) === batchId)
    if (batch?.price !== null && batch?.price !== undefined) {
      setPriceInput(formatDecimalInput(String(batch.price)))
    }
  }

  const handleSubmitQuote = async () => {
    if (activeRfq && isQuoteTerminal(activeRfq)) {
      showToast('Không thể sửa báo giá đã được chấp nhận hoặc từ chối.', 'error')
      return
    }

    const parsedRfqId = parseRfqId(activeRfq?.id)
    const companyId = Number(sessionStorage.getItem('agribridge.auth.companyId'))
    const normalizedPrice = Number(stripToNumeric(priceInput))
    const normalizedQuantity = Number(stripToNumeric(quantityInput))
    const normalizedDeliveryDays = deliveryDaysInput.trim() ? Number(deliveryDaysInput.trim()) : undefined
    const normalizedBatchId = selectedBatchId ? Number(selectedBatchId) : null

    if (!parsedRfqId || !Number.isFinite(companyId) || companyId <= 0) {
      showToast('Không xác định được RFQ hoặc tài khoản nhà cung cấp.', 'error')
      return
    }

    if (!priceInput.trim() || !quantityInput.trim() || !deliveryDaysInput.trim()) {
      showToast('Vui lòng nhập đầy đủ Đơn giá, Số lượng và Thời gian giao dự kiến.', 'error')
      return
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      showToast('Đơn giá phải lớn hơn 0.', 'error')
      return
    }

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      showToast('Số lượng phải lớn hơn 0.', 'error')
      return
    }

    if (normalizedDeliveryDays === undefined || !Number.isInteger(normalizedDeliveryDays) || normalizedDeliveryDays <= 0) {
      showToast('Thời gian giao phải là số ngày nguyên lớn hơn 0.', 'error')
      return
    }

    if (normalizedBatchId !== null) {
      const batch = availableBatches.find((item) => item.id === normalizedBatchId)
      if (!batch || batch.productId !== quoteContext?.rfq.productId || batch.status !== 'AVAILABLE') {
        showToast('Lô dự kiến giao không hợp lệ hoặc không còn AVAILABLE.', 'error')
        return
      }
      if (normalizedQuantity > batch.quantity) {
        showToast('Số lượng báo giá không được lớn hơn số lượng còn lại của lô đã chọn.', 'error')
        return
      }
    }

    try {
      setSubmitting(true)
      await createSupplierQuote(parsedRfqId, {
        supplierCompanyId: companyId,
        batchId: normalizedBatchId,
        price: normalizedPrice,
        quantity: normalizedQuantity,
        deliveryDays: normalizedDeliveryDays,
        note: noteInput.trim(),
        status: 'PENDING',
      })
      setOpenQuote(false)
      reload()
      showToast(`${activeRfq?.hasExistingQuote ? 'Đã cập nhật' : 'Đã gửi'} báo giá cho ${activeRfq?.id ?? 'RFQ'}.`, 'success')
    } catch (error) {
      showToast(readApiErrorMessage(error) || 'Không thể lưu báo giá. Vui lòng thử lại.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SupplierShell
        activeKey="rfq"
        title="RFQ & Báo giá"
        subtitle="Tiếp nhận và xử lý yêu cầu báo giá từ khách hàng"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="Tìm RFQ, khách hàng, sản phẩm..."
              className="min-w-[200px] max-w-xs"
            />
            <FilterTabBar tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
          </div>
        }
      >

        <SupplierPanel>
          {loading && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
              Đang tải dữ liệu realtime...
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">{error}</div>
          )}
          {!loading && !error && rfqItems.length === 0 && (
            <p className="mb-4 text-sm font-medium text-slate-400">Chưa có dữ liệu RFQ & báo giá cho tài khoản này.</p>
          )}

          <div className="space-y-2">
            {!loading && !error && rfqItems.length > 0 && filteredRfqItems.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                Không có RFQ nào khớp với bộ lọc hiện tại.
              </p>
            ) : null}

            {filteredRfqItems.map((rfq) => (
              <article key={rfq.id} className="group rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                {/* Card header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-emerald-900">{rfq.id}</h3>
                    <span className="text-xs text-slate-400">{rfq.customer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SupplierStatusPill label={quoteBadgeLabel(rfq)} />
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Hạn chót</p>
                      <p className="text-xs font-bold text-slate-700">{rfq.dueDate}</p>
                    </div>
                  </div>
                </div>

                {/* Info grid — compact */}
                <div className="grid divide-x divide-slate-100 px-3 py-2 sm:grid-cols-3">
                  <div className="pb-1.5 sm:pb-0 sm:pr-3">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400">Sản phẩm</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800">{rfq.product}</p>
                    <p className="text-[10px] text-slate-400">{rfq.category}</p>
                  </div>
                  <div className="py-1.5 sm:py-0 sm:px-3">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400">Số lượng</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-800">{rfq.quantity}</p>
                    <p className="text-[10px] text-slate-400">{rfq.deliveryDate} · {rfq.province}</p>
                  </div>
                  <div className="pt-1.5 sm:pt-0 sm:pl-3">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400">Giá đã báo</p>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-700">{rfq.supplierQuotedPrice}/{rfq.unit}</p>
                    <p className="text-[10px] text-slate-400">{rfq.supplierQuotedQuantity} · {rfq.quoteCount} báo giá</p>
                  </div>
                </div>

                {rfq.description ? (
                  <div className="border-t border-slate-100 px-3 py-1.5">
                    <p className="text-xs text-slate-500 line-clamp-1">{rfq.description}</p>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
                  {canChangeQuote(rfq) ? (
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
                      onClick={() => handleOpenQuote(rfq.id)}
                    >
                      {rfq.hasExistingQuote ? 'Sửa báo giá' : 'Tạo báo giá'}
                    </button>
                  ) : null}
                  {canChangeQuote(rfq) ? (
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                      disabled={submitting}
                      onClick={() => handleReject(rfq.id)}
                    >
                      {rfq.status === 'Từ chối' ? 'Đã từ chối' : rfq.hasExistingQuote ? 'Từ chối báo giá' : 'Từ chối'}
                    </button>
                  ) : null}
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setActiveRfqId(rfq.id)
                      setOpenChat(true)
                    }}
                  >
                    💬 Chat
                  </button>
                  {(normalizeQuoteStatus(rfq) === 'ACCEPTED' || normalizeQuoteStatus(rfq) === 'APPROVED') && rfq.orderId ? (
                    <button
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      onClick={() => window.location.assign(`/supplier/orders?orderId=${rfq.orderId}`)}
                    >
                      Xem đơn hàng →
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </SupplierPanel>
      </SupplierShell>

      {openQuote ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-8 flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 p-3">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {activeRfq?.hasExistingQuote ? 'Sửa báo giá' : 'Tạo báo giá'} - {activeRfq?.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeRfq?.customer} • {activeRfq?.product} • {activeRfq?.quantity}
                </p>
              </div>
              <button onClick={() => setOpenQuote(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-3">
              <div className="grid gap-2 rounded-xl bg-slate-50 p-2.5 md:grid-cols-3">
                <div><p className="text-xs text-slate-500">Sản phẩm</p><p className="font-semibold">{activeRfq?.product}</p></div>
                <div><p className="text-xs text-slate-500">Loại sản phẩm</p><p className="font-semibold">{activeRfq?.category}</p></div>
                <div><p className="text-xs text-slate-500">Nơi giao</p><p className="font-semibold">{activeRfq?.province}</p></div>
              </div>

              <div className="grid gap-2 rounded-xl bg-slate-50 p-2.5 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Số lượng cần mua</p>
                  <p className="font-semibold">{formatNumber(quoteContext?.rfq.quantity)} {quoteUnit}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ngày giao buyer cần</p>
                  <p className="font-semibold">{quoteContext?.rfq.deliveryDate ? formatDate(quoteContext.rfq.deliveryDate) : activeRfq?.deliveryDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Hạn RFQ</p>
                  <p className="font-semibold">{quoteContext?.rfq.expiredAt ? formatDate(quoteContext.rfq.expiredAt) : activeRfq?.dueDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Trạng thái RFQ</p>
                  <p className="font-semibold">{quoteContext?.rfq.status ?? activeRfq?.status}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Lô hiện có của sản phẩm</h4>
                    <p className="text-xs text-slate-500">Chỉ hiển thị các lô AVAILABLE cùng product_id với RFQ.</p>
                  </div>
                  {quoteContextLoading ? <p className="text-xs font-semibold text-emerald-700">Đang tải lô...</p> : null}
                </div>

                <label className="mb-3 block space-y-1">
                  <span className="text-xs font-semibold text-slate-600">Lô dự kiến giao</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    value={selectedBatchId}
                    onChange={(event) => handleSelectBatch(event.target.value)}
                    disabled={quoteContextLoading}
                  >
                    <option value="">Không chọn lô cụ thể</option>
                    {availableBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        #{batch.id} - còn {formatNumber(batch.quantity)} {batch.unit || quoteUnit} - {formatNumber(batch.price)}đ
                      </option>
                    ))}
                  </select>
                </label>

                {availableBatches.length === 0 && !quoteContextLoading ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                    Chưa có lô AVAILABLE cho sản phẩm này. Supplier vẫn có thể gửi báo giá chung.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {availableBatches.map((batch) => (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => handleSelectBatch(String(batch.id))}
                        className={`rounded-lg border p-3 text-left text-sm transition ${
                          selectedBatchId === String(batch.id)
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-slate-900">Batch #{batch.id}</p>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{batch.status}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600">
                          <span>Còn lại: <b>{formatNumber(batch.quantity)} {batch.unit || quoteUnit}</b></span>
                          <span>Giá: <b>{formatNumber(batch.price)}đ</b></span>
                          <span>Grade: <b>{batch.grade || 'N/A'}</b></span>
                          <span>Size: <b>{batch.size || 'N/A'}</b></span>
                          <span>Thu hoạch: <b>{formatDate(batch.harvestDate)}</b></span>
                          <span>Hết hạn: <b>{formatDate(batch.expiryDate)}</b></span>
                          <span className="col-span-2">Nhiệt độ lưu kho: <b>{batch.storageTemp || 'N/A'}</b></span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Đơn giá (đ/{quoteUnit})</span>
                    <div className="relative">
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-14 text-sm"
                        placeholder="Nhập đơn giá..."
                        value={priceInput}
                        onChange={(event) => setPriceInput(formatDecimalInput(event.target.value))}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                        đ/{quoteUnit}
                      </span>
                    </div>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Số lượng</span>
                    <div className="relative">
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-10 text-sm text-slate-700"
                        placeholder="Mặc định theo số lượng RFQ"
                        value={quantityInput}
                        onChange={(event) => setQuantityInput(formatDecimalInput(event.target.value))}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                        {quoteUnit}
                      </span>
                    </div>
                  </label>
                </div>

                <div className="mt-3 max-w-sm">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Thời gian giao dự kiến (ngày)</span>
                    <div className="relative">
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-14 text-sm"
                        placeholder="Nhập số ngày dự kiến, ví dụ 2 hoặc 3."
                        value={deliveryDaysInput}
                        onChange={(event) => setDeliveryDaysInput(event.target.value.replace(/\D/g, ''))}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                        ngày
                      </span>
                    </div>
                  </label>
                </div>

                <div className="mt-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600">Ghi chú</span>
                    <textarea
                      className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Ví dụ: Giá báo dự kiến, lô cụ thể có thể xác nhận khi chốt đơn/giao hàng."
                      value={noteInput}
                      onChange={(event) => setNoteInput(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-4">
              <button
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700"
                onClick={() => setOpenQuote(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSubmitQuote}
                disabled={submitting}
              >
                {submitting ? 'Đang lưu...' : activeRfq?.hasExistingQuote ? 'Cập nhật báo giá' : 'Gửi báo giá'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openChat ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-16 w-full max-w-lg overflow-hidden rounded-2xl bg-white">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Chat với {activeRfq?.customer.split(' - ')[0]}</h3>
                <p className="text-xs text-slate-500">
                  {activeRfq?.id} • {activeRfq?.product} • {chatConnected ? 'Đã kết nối' : 'Đang kết nối...'}
                </p>
              </div>
              <button onClick={() => setOpenChat(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="max-h-[420px] min-h-72 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {chatLoading ? (
                <p className="text-center text-sm font-semibold text-emerald-700">Đang tải lịch sử chat...</p>
              ) : null}

              {!chatLoading && chatMessages.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-500">
                  Chưa có tin nhắn nào cho RFQ này.
                </p>
              ) : null}

              {chatMessages.map((message) => {
                const isSupplier = message.senderRole === 'SUPPLIER'

                return (
                  <div
                    key={message.id}
                    className={`max-w-[75%] rounded-xl p-3 text-sm ${
                      isSupplier
                        ? 'ml-auto bg-emerald-600 text-white'
                        : 'bg-white text-slate-800 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.message}</p>
                    <p className={`mt-1 text-xs ${isSupplier ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {formatChatTime(message.createdAt)}
                    </p>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-3">
              <input
                className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Nhập tin nhắn..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSendChatMessage()
                  }
                }}
              />
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!chatInput.trim() || !chatConnected}
                onClick={handleSendChatMessage}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
