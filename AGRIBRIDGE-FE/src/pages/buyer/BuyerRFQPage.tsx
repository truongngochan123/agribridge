import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, MessageCircle, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BuyerPanel, SearchInput } from '../../components/buyer/BuyerCommon'
import { BuyerOrderPaymentModal } from '../../components/buyer/BuyerOrderPaymentModal'
import { BuyerQuickOrderModal } from '../../components/buyer/BuyerQuickOrderModal'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import type { BuyerPaymentMethod, BuyerQuickOrderPayload, BuyerQuickOrderPaymentSummary, BuyerQuickOrderTarget } from '../../components/buyer/buyerQuickOrderTypes'
import { RfqChatModal } from '../../components/rfq/RfqChatModal'
import { useBuyerOrderPayment } from '../../hooks/useBuyerOrderPayment'
import { useNotificationModuleRefresh } from '../../hooks/useNotificationModuleRefresh'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useToast } from '../../hooks/useToast'
import {
  cancelBuyerRfq,
  createMarketplaceBuyerRfq,
  getBuyerRfqCompare,
  getBuyerRfqDetail,
  getBuyerRfqOrders,
  getBuyerRfqs,
  updateBuyerRfq,
} from '../../services/buyerRfqApi'
import { fetchBuyerBranches, type BuyerBranchSummary } from '../../services/buyerBranchService'
import { createQuickOrder } from '../../services/buyerOrderService'
import { fetchCategories } from '../../services/supplierService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import { getBranchContextFromSearchParams } from '../../utils/branchContext'
import type { CategoryOption } from '../../types/supplierCreateFlow'
import type {
  BuyerQuoteCompareItem,
  BuyerRfqCompareInfo,
  BuyerRfqCompareResponse,
  BuyerRfqDetail,
  BuyerRfqListItem,
  BuyerRfqOrderItem,
  CreateBuyerRfqRequest,
  UpdateBuyerRfqRequest,
} from '../../types/buyerRfq'

type RfqFormMode = 'create' | 'update'

type RfqFormState = {
  title: string
  productName: string
  categoryId: string
  branchId: string
  quantity: string
  unit: string
  province: string
  deliveryDate: string
  expiredAt: string
  description: string
}

type BuyerChatTarget = {
  rfqId: number
  rfqCode: string
  supplierCompanyId: number
  supplierName: string
  subtitle?: string
}

type RfqQuickOrderSelection = {
  rfqId: number
  quoteId: number
  target: BuyerQuickOrderTarget
}

type QuickOrderPaymentModalData = {
  orderId: number
  paymentId?: number | null
  orderCode: string
  productName: string
  quantity: number
  unit?: string | null
  subtotal?: number | null
  shippingFee?: number | null
  totalAmount?: number | null
  transferContent?: string | null
  paymentMethod: BuyerPaymentMethod
  creditTermDays?: number | null
  supplierName?: string | null
  creditLimit?: number | null
  remainingCreditAfterOrder?: number | null
  orderStatus?: string | null
}

const emptyForm: RfqFormState = {
  title: '',
  productName: '',
  categoryId: '',
  branchId: '',
  quantity: '',
  unit: 'kg',
  province: '',
  deliveryDate: '',
  expiredAt: '',
  description: '',
}

export function BuyerRFQPage() {
  usePageTitle('Yêu cầu báo giá')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { confirmPayment, confirming } = useBuyerOrderPayment()
  const [rfqs, setRfqs] = useState<BuyerRfqListItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [detail, setDetail] = useState<BuyerRfqDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [compareData, setCompareData] = useState<BuyerRfqCompareResponse | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)
  const [quickOrderSelection, setQuickOrderSelection] = useState<RfqQuickOrderSelection | null>(null)
  const [paymentModalData, setPaymentModalData] = useState<QuickOrderPaymentModalData | null>(null)

  const [orders, setOrders] = useState<BuyerRfqOrderItem[]>([])
  const [ordersRfqId, setOrdersRfqId] = useState<number | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [chatTarget, setChatTarget] = useState<BuyerChatTarget | null>(null)

  const [formMode, setFormMode] = useState<RfqFormMode | null>(null)
  const [editingRfqId, setEditingRfqId] = useState<number | null>(null)
  const [form, setForm] = useState<RfqFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submittingCreate, setSubmittingCreate] = useState(false)
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [openedRfqParam, setOpenedRfqParam] = useState('')
  const [openedActionParam, setOpenedActionParam] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [branches, setBranches] = useState<BuyerBranchSummary[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const branchContext = getBranchContextFromSearchParams(searchParams)
  const branchLabel = branchContext?.branchName || (branchContext?.branchId ? `Chi nhánh #${branchContext.branchId}` : '')

  const loadRfqs = useCallback(async () => {
    setLoadingList(true)
    setListError(null)
    try {
      const data = await getBuyerRfqs({
        page: 0,
        size: 20,
        keyword: appliedKeyword,
        status: appliedStatus,
      })
      setRfqs(data.content ?? [])
    } catch (error) {
      setListError(formatBuyerRfqError(error, 'Không thể tải danh sách RFQ'))
    } finally {
      setLoadingList(false)
    }
  }, [appliedKeyword, appliedStatus])

  useEffect(() => {
    void loadRfqs()
  }, [loadRfqs])

  useNotificationModuleRefresh(['RFQ', 'QUOTE'], loadRfqs)

  useEffect(() => {
    if (!formMode) return
    let isActive = true
    setOptionsLoading(true)
    setOptionsError(null)

    Promise.allSettled([
      fetchCategories(),
      fetchBuyerBranches(),
    ])
      .then((results) => {
        if (!isActive) return
        const [categoriesResult, branchesResult] = results
        if (categoriesResult.status === 'fulfilled') {
          setCategories(categoriesResult.value ?? [])
        }
        if (branchesResult.status === 'fulfilled') {
          setBranches(branchesResult.value ?? [])
        }
        if ([categoriesResult, branchesResult].some((result) => result.status === 'rejected')) {
          setOptionsError('Không thể tải danh sách danh mục/chi nhánh. Vui lòng thử lại.')
        }
      })
      .finally(() => {
        if (isActive) setOptionsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [formMode])

  useEffect(() => {
    if (formMode !== 'create') return
    if (branches.length === 0) return
    if (form.branchId.trim()) return
    const firstBranch = branches.find((branch) => String(branch.rawId) === branchContext?.branchId) || branches[0]
    if (!firstBranch) return
    const deliveryLocation = firstBranch.deliveryAddress || firstBranch.address || firstBranch.province || ''
    setForm((prev) => ({
      ...prev,
      branchId: String(firstBranch.rawId),
      province: deliveryLocation || prev.province,
    }))
  }, [branchContext?.branchId, branches, form.branchId, form.province, formMode])

  
  const openUpdateForm = async (rfq: BuyerRfqListItem | BuyerRfqDetail) => {
    setFormMode('update')
    setEditingRfqId(rfq.id)
    setFormError(null)
    const current = 'description' in rfq ? rfq : await safeLoadDetail(rfq.id)
    setForm({
      title: current?.title ?? rfq.title ?? '',
      productName: current?.productName ?? current?.product ?? rfq.productName ?? rfq.product ?? '',
      categoryId: String(current?.categoryId ?? rfq.categoryId ?? ''),
      branchId: String(current?.branchId ?? rfq.branchId ?? ''),
      quantity: String(current?.quantity ?? rfq.quantity ?? ''),
      unit: current?.unit ?? rfq.unit ?? 'kg',
      province: current?.province ?? rfq.province ?? '',
      deliveryDate: toDateInput(current?.deliveryDate ?? rfq.deliveryDate),
      expiredAt: toDateTimeInput(current?.deadline ?? current?.expiredAt ?? rfq.deadline ?? rfq.expiredAt),
      description: current?.description ?? '',
    })
  }

  const safeLoadDetail = async (rfqId: number) => {
    try {
      return await getBuyerRfqDetail(rfqId)
    } catch {
      return null
    }
  }

  const openDetail = async (rfqId: number) => {
    setLoadingDetail(true)
    setDetailError(null)
    try {
      setDetail(await getBuyerRfqDetail(rfqId))
    } catch (error) {
      setDetailError(formatBuyerRfqError(error, 'Không thể tải chi tiết RFQ'))
    } finally {
      setLoadingDetail(false)
    }
  }

  const openCompare = async (rfqId: number) => {
    setLoadingCompare(true)
    setCompareError(null)
    setSelectedQuoteId(null)
    try {
      setCompareData(await getBuyerRfqCompare(rfqId))
    } catch (error) {
      setCompareError(formatBuyerRfqError(error, 'Không thể tải báo giá'))
    } finally {
      setLoadingCompare(false)
    }
  }

  const openOrders = async (rfqId: number) => {
    setOrdersRfqId(rfqId)
    setLoadingOrders(true)
    setOrdersError(null)
    try {
      setOrders(await getBuyerRfqOrders(rfqId))
    } catch (error) {
      setOrdersError(formatBuyerRfqError(error, 'Không thể tải đơn hàng của RFQ'))
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    const rfqId = searchParams.get('rfqId') || ''
    const parsed = Number(rfqId)
    if (!rfqId || openedRfqParam === rfqId || !Number.isFinite(parsed) || parsed <= 0) return
    setOpenedRfqParam(rfqId)
    void openDetail(parsed)
  }, [openedRfqParam, searchParams])

  useEffect(() => {
    const action = searchParams.get('action') || ''
    const supplierName = searchParams.get('supplierName') || ''
    const productName = searchParams.get('productName') || ''
    const actionKey = `${action}:${searchParams.get('supplierId') || ''}:${searchParams.get('productId') || ''}:${productName}`
    if (!action || openedActionParam === actionKey) return
    setOpenedActionParam(actionKey)

    if (action === 'create') {
      setFormMode('create')
      setEditingRfqId(null)
      setFormError(null)
      setForm((prev) => ({
        ...prev,
        title: productName ? `Cần báo giá ${productName}` : supplierName ? `Cần báo giá từ ${supplierName}` : prev.title,
        productName: productName || prev.productName,
        description: supplierName ? `Ưu tiên nhà cung cấp: ${supplierName}` : prev.description,
      }))
      return
    }

    if (action === 'contact' || action === 'compare') {
      const keywordValue = supplierName || productName
      if (keywordValue) {
        setKeyword(keywordValue)
        setAppliedKeyword(keywordValue)
      }
    }
  }, [openedActionParam, searchParams])

  const handleSearch = () => {
    setAppliedKeyword(keyword.trim())
    setAppliedStatus(status)
  }

  const handleRefresh = () => {
    setKeyword('')
    setStatus('')
    setAppliedKeyword('')
    setAppliedStatus('')
  }

  const filteredRfqs = useMemo(() => {
    if (!branchContext?.branchId) return rfqs
    return rfqs.filter((item) => String(item.branchId ?? '') === branchContext.branchId)
  }, [branchContext?.branchId, rfqs])

  const submitForm = async () => {
    const validation = validateForm(form, formMode)
    if (validation) {
      setFormError(validation)
      return
    }

    setFormError(null)
    try {
      if (formMode === 'create') {
        setSubmittingCreate(true)
        await createMarketplaceBuyerRfq(buildCreatePayload(form))
        alert('Tạo RFQ thành công')
      } else if (formMode === 'update' && editingRfqId) {
        setSubmittingUpdate(true)
        await updateBuyerRfq(editingRfqId, buildUpdatePayload(form))
        alert('Cập nhật RFQ thành công')
        if (detail?.id === editingRfqId) {
          setDetail(await getBuyerRfqDetail(editingRfqId))
        }
      }
      setFormMode(null)
      setEditingRfqId(null)
      await loadRfqs()
    } catch (error) {
      setFormError(formatBuyerRfqError(error, 'Không thể lưu RFQ'))
    } finally {
      setSubmittingCreate(false)
      setSubmittingUpdate(false)
    }
  }

  const handleCancelRfq = async (rfqId: number) => {
    if (!window.confirm('Bạn chắc chắn muốn hủy RFQ này?')) return
    setCancelling(rfqId)
    try {
      await cancelBuyerRfq(rfqId)
      alert('Đã hủy RFQ')
      await loadRfqs()
      if (detail?.id === rfqId) {
        setDetail(null)
      }
    } catch (error) {
      alert(formatBuyerRfqError(error, 'Không thể hủy RFQ'))
    } finally {
      setCancelling(null)
    }
  }

  const handleConvert = async () => {
    if (!compareData || selectedQuoteId == null) return
    const selectedQuote = compareData.quotes.find((quote) => quote.id === selectedQuoteId)
    if (!selectedQuote) return

    const productId = selectedQuote.productId ?? compareData.rfq.productId
    if (!productId || !selectedQuote.batchId) {
      setCompareError('Bao gia nay chua co lo hang hop le de dat hang.')
      return
    }

    setQuickOrderSelection({
      rfqId: compareData.rfq.id,
      quoteId: selectedQuote.id,
      target: {
        productId,
        categoryId: compareData.rfq.categoryId ?? null,
        productName: compareData.rfq.productName || compareData.rfq.product || 'San pham RFQ',
        supplierName: selectedQuote.supplierName ?? null,
        supplierId: selectedQuote.supplierId ?? null,
        supplierCompanyId: selectedQuote.supplierId ?? null,
        supplierProvince: selectedQuote.supplierProvince ?? null,
        originRegion: selectedQuote.supplierProvince ?? null,
        unit: selectedQuote.unit || compareData.rfq.unit || 'kg',
        price: selectedQuote.price ?? null,
        minMoq: selectedQuote.quantity ?? compareData.rfq.quantity ?? 1,
        availableQuantity: selectedQuote.quantity ?? compareData.rfq.quantity ?? null,
        batchId: selectedQuote.batchId,
        batchCode: selectedQuote.batchCode ?? null,
        grade: selectedQuote.gradeSize ?? null,
        expiryDate: selectedQuote.expiryDate ?? null,
        expired: false,
      },
    })
    setCompareData(null)
    setCompareError(null)
    setSelectedQuoteId(null)
  }

  const handleQuickOrderSubmit = async (payload: BuyerQuickOrderPayload, summary?: BuyerQuickOrderPaymentSummary) => {
    if (!quickOrderSelection) return
    setConverting(true)
    const currentSelection = quickOrderSelection
    try {
      const result = await createQuickOrder({
        ...payload,
        rfqId: currentSelection.rfqId,
        quoteId: currentSelection.quoteId,
        note: payload.note || `Created from RFQ #${currentSelection.rfqId}`,
      })
      showToast(payload.paymentMethod === 'CREDIT' ? 'Da tao don hang cong no.' : 'Tao don hang thanh cong. Vui long hoan tat thanh toan.', 'success')
      setQuickOrderSelection(null)
      setPaymentModalData({
        orderId: result.orderId,
        paymentId: result.paymentId,
        orderCode: result.orderCode,
        productName: currentSelection.target.productName,
        quantity: payload.quantity,
        unit: payload.unit,
        subtotal: payload.subtotal,
        shippingFee: payload.shippingFee,
        totalAmount: result.payableAmount ?? result.grandTotal ?? (payload.subtotal ?? 0) + (payload.shippingFee ?? 0),
        transferContent: result.transferContent ?? null,
        paymentMethod: payload.paymentMethod,
        creditTermDays: payload.creditTermDays ?? null,
        supplierName: summary?.supplierName ?? currentSelection.target.supplierName ?? null,
        creditLimit: summary?.creditLimit ?? null,
        remainingCreditAfterOrder: summary?.remainingCreditAfterOrder ?? null,
        orderStatus: result.orderStatus ?? summary?.orderStatus ?? null,
      })
      await loadRfqs()
    } catch (error) {
      setCompareError(formatBuyerRfqError(error, 'Khong the tao don hang tu bao gia'))
    } finally {
      setConverting(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!paymentModalData) return
    const updated = await confirmPayment({ orderId: paymentModalData.orderId, paymentId: paymentModalData.paymentId })
    if (updated) {
      setPaymentModalData(null)
      navigate(`/buyer/orders?orderId=${paymentModalData.orderId}`)
    }
  }

  const openChatForRfqSupplier = (rfq: BuyerRfqListItem | BuyerRfqDetail | BuyerRfqCompareInfo, supplierCompanyId?: number | null, supplierName?: string | null) => {
    if (!supplierCompanyId) {
      alert('RFQ này có nhiều nhà cung cấp. Vui lòng mở "Xem báo giá" rồi bấm Chat trên từng nhà cung cấp.')
      return
    }
    setChatTarget({
      rfqId: rfq.id,
      rfqCode: rfq.code || rfqCode(rfq.id),
      supplierCompanyId,
      supplierName: supplierName || 'Nhà cung cấp',
      subtitle: `${rfq.product || rfq.productName || 'Sản phẩm'} · ${formatNumber(rfq.quantity)} ${rfq.unit || ''}`.trim(),
    })
  }

  const formTitle = formMode === 'create' ? 'Tạo RFQ mới' : 'Sửa RFQ'
  const formSubmitting = submittingCreate || submittingUpdate

  return (
    <>
      <BuyerShell
        activeKey="rfq"
        title={branchLabel ? `RFQ & Báo giá - ${branchLabel}` : 'RFQ & Báo giá'}
        subtitle={branchLabel ? 'Đang xem RFQ trong phạm vi chi nhánh' : 'Quản lý yêu cầu báo giá và so sánh'}
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
            <SearchInput
              value={keyword}
              onChange={(v) => { setKeyword(v) }}
              placeholder="Tìm theo sản phẩm, tiêu đề, tỉnh..."
              className="min-w-[240px] max-w-sm"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="OPEN">Đang mở</option>
              <option value="QUOTED">Đã có báo giá</option>
              <option value="ACCEPTED">Đã chọn báo giá</option>
              <option value="CLOSED">Đã đóng</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
            <button
              className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              onClick={handleSearch}
              disabled={loadingList}
            >
              Tìm kiếm
            </button>
            <button
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              onClick={handleRefresh}
              disabled={loadingList}
            >
              Làm mới
            </button>
            <button
              className="ml-auto h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 text-xs font-bold text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
              onClick={() => setFormMode('create')}
            >
              + Đăng nhu cầu mua
            </button>
          </div>
        }
      >
        <BuyerPanel title="Yêu cầu Báo giá của tôi">
          {loadingList ? (
            <RfqSkeletonList />
          ) : null}
          {listError && !loadingList && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {listError}
              <button className="ml-2 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white" onClick={loadRfqs}>Thử lại</button>
            </div>
          )}
          {!loadingList && !listError && filteredRfqs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">Chưa có yêu cầu báo giá nào</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredRfqs.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900">{item.code || rfqCode(item.id)}</h4>
                      <RfqStatusBadge status={item.status} />
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">{item.quoteCount ?? 0} báo giá</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">Tạo ngày: {formatDate(item.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-slate-400">Hạn chót</p>
                    <p className="text-xs font-bold text-slate-800">{formatDate(item.deadline ?? item.expiredAt)}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <InfoTile label="Sản phẩm" value={item.product || 'Chưa có'} />
                  <InfoTile label="Số lượng" value={`${formatNumber(item.quantity)} ${item.unit || ''}`.trim()} />
                  <InfoTile label="Giá mục tiêu" value={item.targetPrice == null ? 'Chưa đặt' : formatCurrency(item.targetPrice)} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                    onClick={() => openCompare(item.id)}
                    disabled={loadingCompare}
                  >
                    So sánh ({item.quoteCount ?? 0})
                  </button>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                    onClick={() => openDetail(item.id)}
                    disabled={loadingDetail}
                  >
                    Chi tiết
                  </button>
                  <button
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    onClick={() => openUpdateForm(item)}
                  >
                    Sửa
                  </button>
                  {canCancel(item.status) && (
                    <button
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60"
                      onClick={() => handleCancelRfq(item.id)}
                      disabled={cancelling === item.id}
                    >
                      {cancelling === item.id ? 'Hủy...' : 'Hủy RFQ'}
                    </button>
                  )}
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                    onClick={() => openOrders(item.id)}
                    disabled={loadingOrders}
                  >
                    Đơn hàng
                  </button>
                </div>
              </article>
            ))}
          </div>
        </BuyerPanel>
      </BuyerShell>

      {loadingCompare ? <Overlay><StateBox text="Đang tải báo giá..." /></Overlay> : null}
      {compareError && !compareData && !loadingCompare ? <ToastModal title="Lỗi báo giá" message={compareError} onClose={() => setCompareError(null)} /> : null}
      {compareData ? (
        <CompareModal
          data={compareData}
          error={compareError}
          selectedQuoteId={selectedQuoteId}
          converting={converting}
          onSelect={setSelectedQuoteId}
          onClose={() => {
            setCompareData(null)
            setCompareError(null)
            setSelectedQuoteId(null)
          }}
          onConvert={handleConvert}
          onChat={(rfq, quote) => openChatForRfqSupplier(rfq, quote.supplierId, quote.supplierName)}
        />
      ) : null}

      {(loadingDetail || detail || detailError) ? (
        <DetailModal
          detail={detail}
          loading={loadingDetail}
          error={detailError}
          onClose={() => {
            setDetail(null)
            setDetailError(null)
          }}
          onEdit={(rfq) => openUpdateForm(rfq)}
          onCancel={(rfqId) => handleCancelRfq(rfqId)}
          onCompare={(rfqId) => openCompare(rfqId)}
        />
      ) : null}

      {formMode ? (
        <FormModal
          title={formTitle}
          form={form}
          error={formError}
          optionsError={optionsError}
          optionsLoading={optionsLoading}
          categories={categories}
          submitting={formSubmitting}
          onChange={setForm}
          onClose={() => {
            setFormMode(null)
            setEditingRfqId(null)
            setFormError(null)
          }}
          onSubmit={submitForm}
        />
      ) : null}

      {ordersRfqId ? (
        <OrdersModal
          rfqId={ordersRfqId}
          orders={orders}
          loading={loadingOrders}
          error={ordersError}
          onClose={() => {
            setOrdersRfqId(null)
            setOrders([])
            setOrdersError(null)
          }}
        />
      ) : null}

      {quickOrderSelection ? (
        <BuyerQuickOrderModal
          target={quickOrderSelection.target}
          submitting={converting}
          onClose={() => setQuickOrderSelection(null)}
          onSubmit={handleQuickOrderSubmit}
        />
      ) : null}

      {paymentModalData ? (
        <BuyerOrderPaymentModal
          open={Boolean(paymentModalData)}
          orderCode={paymentModalData.orderCode}
          productName={paymentModalData.productName}
          quantity={paymentModalData.quantity}
          unit={paymentModalData.unit}
          subtotal={paymentModalData.subtotal}
          shippingFee={paymentModalData.shippingFee}
          totalAmount={paymentModalData.totalAmount}
          paymentMethod={paymentModalData.paymentMethod}
          creditTermDays={paymentModalData.creditTermDays}
          supplierName={paymentModalData.supplierName}
          creditLimit={paymentModalData.creditLimit}
          remainingCreditAfterOrder={paymentModalData.remainingCreditAfterOrder}
          orderStatus={paymentModalData.orderStatus}
          transferContent={paymentModalData.transferContent}
          confirming={confirming}
          onClose={() => setPaymentModalData(null)}
          onViewOrder={() => navigate(`/buyer/orders?orderId=${paymentModalData.orderId}`)}
          onConfirmPaid={() => void handleConfirmPayment()}
        />
      ) : null}

      {chatTarget ? (
        <RfqChatModal
          rfqId={chatTarget.rfqId}
          supplierCompanyId={chatTarget.supplierCompanyId}
          rfqCode={chatTarget.rfqCode}
          title={`Chat với ${chatTarget.supplierName}`}
          subtitle={chatTarget.subtitle}
          onClose={() => setChatTarget(null)}
        />
      ) : null}
    </>
  )
}

function CompareModal({
  data,
  error,
  selectedQuoteId,
  converting,
  onSelect,
  onClose,
  onConvert,
  onChat,
}: {
  data: BuyerRfqCompareResponse
  error: string | null
  selectedQuoteId: number | null
  converting: boolean
  onSelect: (quoteId: number) => void
  onClose: () => void
  onConvert: () => void
  onChat: (rfq: BuyerRfqCompareInfo, quote: BuyerQuoteCompareItem) => void
}) {
  // Find best price for highlighting
  const bestPrice = data.quotes.length > 0
    ? Math.min(...data.quotes.map((q) => q.price ?? Infinity))
    : null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      {/* flex-col so only body scrolls, header+footer stay fixed */}
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 px-6 py-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{ backgroundImage: 'radial-gradient(ellipse at 85% 0%, rgba(255,255,255,0.8) 0%, transparent 55%)' }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-xl font-black text-white drop-shadow">So sánh báo giá</h3>
                <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white ring-1 ring-white/25">
                  {data.rfq.code || rfqCode(data.rfq.id)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-white/70">
                {data.rfq.product || 'Chưa có sản phẩm'} · {formatNumber(data.rfq.quantity)} {data.rfq.unit || ''}
              </p>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/80 transition hover:bg-white/25"
              onClick={onClose}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* RFQ summary chips */}
          <div className="relative mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15">
              Giá mục tiêu: <span className="font-black text-amber-200">{data.rfq.targetPrice == null ? 'Chưa đặt' : formatCurrency(data.rfq.targetPrice)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15">
              Hạn chót: <span className="font-bold text-white">{formatDate(data.rfq.deadline)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15">
              Giao: <span className="font-bold text-white">{data.rfq.deliveryAddress || data.rfq.province || 'Chưa có'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-3 py-1 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-300/30">
              {data.quotes.length} báo giá nhận được
            </span>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4">
          {error ? (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {data.quotes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
                <span className="text-3xl">📋</span>
              </div>
              <p className="text-sm font-bold text-slate-600">Chưa có báo giá nào cho RFQ này</p>
              <p className="text-xs text-slate-400">Nhà cung cấp sẽ gửi báo giá sau khi xem xét yêu cầu của bạn</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${
              data.quotes.length === 1 ? 'max-w-sm mx-auto' :
              data.quotes.length === 2 ? 'sm:grid-cols-2' :
              'sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {data.quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  checked={selectedQuoteId === quote.id}
                  isBest={bestPrice !== null && quote.price === bestPrice && data.quotes.length > 1}
                  onSelect={() => onSelect(quote.id)}
                  onChat={() => onChat(data.rfq, quote)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer (sticky) ── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
          <p className="text-xs text-slate-400">
            {selectedQuoteId ? (
              <span className="font-semibold text-emerald-700">✓ Đã chọn 1 báo giá để chuyển đơn hàng</span>
            ) : (
              'Chọn một báo giá để chuyển thành đơn hàng'
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
              onClick={onClose}
            >
              Đóng
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedQuoteId || converting}
              onClick={onConvert}
            >
              {converting ? (
                <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Đang chuyển...</>
              ) : (
                '🛒 Chuyển thành đơn hàng'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuoteCard({
  quote,
  checked,
  isBest,
  onSelect,
  onChat,
}: {
  quote: BuyerQuoteCompareItem
  checked: boolean
  isBest: boolean
  onSelect: () => void
  onChat: () => void
}) {
  return (
    <article
      className={`relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        checked
          ? 'border-emerald-500 shadow-emerald-100 ring-4 ring-emerald-100'
          : isBest
          ? 'border-amber-300 shadow-amber-50'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
      onClick={onSelect}
    >
      {/* Best price badge */}
      {isBest ? (
        <div className="absolute left-0 right-0 top-0 flex items-center justify-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 py-1">
          <span className="text-[10px] font-black text-white">🏆 GIÁ TỐT NHẤT</span>
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col p-4 ${isBest ? 'pt-7' : ''}`}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">{quote.supplierName || 'Nhà cung cấp'}</p>
            {quote.supplierRating != null ? (
              <div className="mt-0.5 flex items-center gap-1">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-[11px] ${i < Math.round(quote.supplierRating ?? 0) ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {quote.supplierRating}/5{quote.supplierOrderCount ? ` · ${quote.supplierOrderCount} đơn` : ''}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">Chưa có đánh giá</p>
            )}
          </div>
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
              checked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
            }`}
            onClick={(e) => { e.stopPropagation(); onSelect() }}
          >
            {checked ? <span className="text-[10px] font-black text-white">✓</span> : null}
          </div>
        </div>

        {/* Tags */}
        {(quote.tags ?? []).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {(quote.tags ?? []).map((tag) => (
              <span key={tag} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{tag}</span>
            ))}
          </div>
        ) : null}

        {/* Price block */}
        <div className={`mt-3 rounded-xl px-3 py-3 text-center ${
          isBest
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 ring-1 ring-amber-200'
            : checked
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-200'
            : 'bg-slate-50'
        }`}>
          <p className={`text-2xl font-black ${
            isBest ? 'text-orange-600' : checked ? 'text-emerald-700' : 'text-slate-800'
          }`}>
            {formatCurrency(quote.price)}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">mỗi {quote.unit || 'kg'}</p>
          <p className="mt-1 text-xs font-bold text-slate-600">Tổng: {formatCurrency(quote.total)}</p>
        </div>

        {/* Details */}
        <div className="mt-3 space-y-1.5 text-xs">
          {[
            { label: 'Mã lô', value: quote.batchCode || 'Chưa có' },
            { label: 'Grade/Size', value: quote.gradeSize || 'Chưa có' },
            { label: 'Thu hoạch', value: formatDate(quote.harvestDate) },
            { label: 'Giao hàng', value: formatDate(quote.estimatedDeliveryDate) },
            { label: 'Thời gian', value: quote.deliveryDays == null ? 'Chưa có' : `${quote.deliveryDays} ngày` },
            { label: 'Phí ship', value: quote.shippingFee == null ? 'Chưa cập nhật' : formatCurrency(quote.shippingFee) },
            { label: 'Thanh toán', value: quote.paymentTerm || quote.note || 'Chưa có' },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{row.label}</span>
              <span className="truncate text-right font-semibold text-slate-700">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Status badge */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            quote.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
            quote.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {rfqStatusLabel(quote.status)}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
            onClick={(e) => { e.stopPropagation(); onChat() }}
          >
            <MessageCircle className="h-3 w-3" />
            Chat
          </button>
        </div>
      </div>
    </article>
  )
}

function DetailModal({
  detail,
  loading,
  error,
  onClose,
  onEdit,
  onCancel,
  onCompare,
}: {
  detail: BuyerRfqDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
  onEdit: (rfq: BuyerRfqDetail) => void
  onCancel: (rfqId: number) => void
  onCompare: (rfqId: number) => void
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-8 w-[94vw] max-w-2xl rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-xl font-extrabold text-slate-900">Chi tiết RFQ</h3>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>
        {loading ? <StateBox text="Đang tải chi tiết RFQ..." /> : null}
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        {detail ? (
          <>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <InfoRow label="Mã RFQ" value={detail.code || rfqCode(detail.id)} />
              <InfoRow label="Trạng thái" value={rfqStatusLabel(detail.status)} />
              <InfoRow label="Tiêu đề" value={detail.title || 'Chưa có'} />
              <InfoRow label="Sản phẩm" value={detail.product || 'Chưa có'} />
              <InfoRow label="Mã sản phẩm" value={String(detail.productId ?? 'Chưa có')} />
              <InfoRow label="Mã danh mục" value={String(detail.categoryId ?? 'Chưa có')} />
              <InfoRow label="Số lượng" value={`${formatNumber(detail.quantity)} ${detail.unit || ''}`.trim()} />
              <InfoRow label="Tỉnh" value={detail.province || 'Chưa có'} />
              <InfoRow label="Chi nhánh" value={detail.branch?.name || detail.branch?.address || 'Chưa có'} />
              <InfoRow label="Ngày giao" value={formatDate(detail.deliveryDate)} />
              <InfoRow label="Hết hạn" value={formatDate(detail.deadline ?? detail.expiredAt)} />
              <InfoRow label="Ngày tạo" value={formatDateTime(detail.createdAt)} />
              <InfoRow label="Báo giá" value={`${detail.quoteCount ?? 0}`} />
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-500">Mô tả</p>
              <p className="mt-1 text-slate-800">{detail.description || 'Chưa có'}</p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {canEdit(detail.status) ? <button className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700" onClick={() => onEdit(detail)}>Sửa RFQ</button> : null}
              {canCancel(detail.status) ? <button className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={() => onCancel(detail.id)}>Hủy RFQ</button> : null}
              <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => onCompare(detail.id)}>Xem báo giá</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function FormModal({
  title,
  form,
  error,
  optionsError,
  optionsLoading,
  categories,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string
  form: RfqFormState
  error: string | null
  optionsError: string | null
  optionsLoading: boolean
  categories: CategoryOption[]
  submitting: boolean
  onChange: (form: RfqFormState) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const setField = (field: keyof RfqFormState, value: string) => onChange({ ...form, [field]: value })
  const isCreate = title.includes('Tạo')

  function dateAfterDays(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function datetimeAfterDays(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(23, 59, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/60 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 px-6 py-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(ellipse at 85% 10%, rgba(255,255,255,0.6) 0%, transparent 60%)' }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/20">
                <span className="text-xl">{isCreate ? '📋' : '✏️'}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-black text-white drop-shadow">{title}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ${isCreate ? 'bg-emerald-400/20 text-emerald-200 ring-emerald-300/30' : 'bg-amber-400/20 text-amber-200 ring-amber-300/30'}`}>
                    {isCreate ? 'MỚI' : 'CẬP NHẬT'}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-white/65">
                  {isCreate ? 'Gửi yêu cầu để nhận báo giá từ nhà cung cấp' : 'Chỉnh sửa thông tin yêu cầu báo giá'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/80 transition hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-5">

            {/* Error banners */}
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}
            {optionsError ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {optionsError}
              </div>
            ) : null}
            {optionsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                Đang tải danh mục / chi nhánh...
              </div>
            ) : null}

            {/* Section 1: Thông tin cơ bản */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                  <span className="text-sm">📦</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Thông tin cơ bản</p>
                  <p className="text-[10px] text-slate-400">Tiêu đề, sản phẩm, danh mục và số lượng</p>
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Tiêu đề <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="Ví dụ: Cần mua cà hồi tươi 200kg/tuần"
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Sản phẩm cần mua <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.productName}
                    onChange={(e) => setField('productName', e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="Tên sản phẩm..."
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Danh mục <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setField('categoryId', e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Số lượng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.quantity}
                    onChange={(e) => setField('quantity', e.target.value)}
                    type="number"
                    min="0"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Đơn vị <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) => setField('unit', e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="kg, thùng, tấn..."
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Thời gian */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                  <span className="text-sm">📅</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Thời gian</p>
                  <p className="text-[10px] text-slate-400">Hạn nhận báo giá và ngày giao hàng mong muốn</p>
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Hạn nhận báo giá <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.expiredAt}
                    onChange={(e) => setField('expiredAt', e.target.value)}
                    type="datetime-local"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setField('expiredAt', datetimeAfterDays(0))} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">Hôm nay</button>
                    {[3, 7, 14].map((d) => (
                      <button key={d} type="button" onClick={() => setField('expiredAt', datetimeAfterDays(d))} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">+{d} ngày</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Ngày giao mong muốn <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.deliveryDate}
                    onChange={(e) => setField('deliveryDate', e.target.value)}
                    type="date"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[7, 14, 30].map((d) => (
                      <button key={d} type="button" onClick={() => setField('deliveryDate', dateAfterDays(d))} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">+{d} ngày</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Địa điểm & Mô tả */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                  <span className="text-sm">📍</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Địa điểm & Mô tả</p>
                  <p className="text-[10px] text-slate-400">Nơi nhận hàng và yêu cầu chi tiết</p>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Địa điểm giao hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.province}
                    onChange={(e) => setField('province', e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="Ví dụ: TP. Hồ Chí Minh"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Mô tả / Yêu cầu thêm</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="Ví dụ: cần loại A, đóng thùng 20kg, giao trước 8h, ưu tiên VietGAP..."
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <p className="text-[11px] text-slate-400">
            <span className="text-rose-500">*</span> Trường bắt buộc
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              Hủy
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Đang lưu...
                </>
              ) : (
                isCreate ? '🚀 Gửi yêu cầu' : '💾 Lưu thay đổi'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function OrdersModal({ rfqId, orders, loading, error, onClose }: { rfqId: number; orders: BuyerRfqOrderItem[]; loading: boolean; error: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-10 w-[94vw] max-w-2xl rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-xl font-extrabold text-slate-900">Đơn hàng từ {rfqCode(rfqId)}</h3>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>
        {loading ? <StateBox text="Đang tải đơn hàng..." /> : null}
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        {!loading && !error && orders.length === 0 ? <StateBox text="RFQ này chưa được chuyển thành đơn hàng" /> : null}
        <div className="mt-3 space-y-2">
          {orders.map((order) => (
            <article key={order.orderId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <InfoRow label="Mã đơn" value={String(order.orderId)} />
              <InfoRow label="Mã báo giá" value={String(order.quoteId ?? 'Chưa có')} />
              <InfoRow label="Nhà cung cấp" value={order.supplierName || 'Chưa có'} />
              <InfoRow label="Tổng tiền" value={formatCurrency(order.totalAmount)} />
              <InfoRow label="Trạng thái" value={rfqOrderStatusLabel(order.orderStatus)} />
              <InfoRow label="Ngày tạo" value={formatDateTime(order.createdAt)} />
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-emerald-50 p-2.5"><p className="text-xs text-emerald-700/70">{label}</p><p className="text-sm font-semibold">{value}</p></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="grid grid-cols-[92px_1fr] gap-1 border-b border-slate-100 pb-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </p>
  )
}

function StateBox({ text }: { text: string }) {
  return <div className="my-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-5 text-center text-sm font-semibold text-emerald-800">{text}</div>
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[80] bg-black/35 p-4"><div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-4">{children}</div></div>
}

function ToastModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
      </div>
    </div>
  )
}

function validateForm(form: RfqFormState, mode: RfqFormMode | null): string | null {
  if (!form.title.trim()) return 'title không được để trống'
  if (!form.productName.trim()) return 'productName không được để trống'
  if (!optionalNumber(form.categoryId)) return 'categoryId không được để trống'
  const quantity = Number(form.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return 'quantity phải lớn hơn 0'
  if (!form.unit.trim()) return 'unit không được để trống'
  if (!form.province.trim()) return 'province không được để trống'
  if (!form.deliveryDate) return 'deliveryDate không được để trống'
  if (form.expiredAt && new Date(form.expiredAt).getTime() <= Date.now()) return 'expiredAt phải lớn hơn hiện tại'
  if (mode === 'create' && !form.expiredAt) return 'expiredAt không được để trống'
  return null
}

function formatBuyerRfqError(error: unknown, fallback: string) {
  const message = readApiErrorMessage(error)
  if (message === 'UNAUTHORIZED') return 'Bạn cần đăng nhập bằng tài khoản buyer để xem RFQ.'
  if (message === 'COMPANY_IS_NOT_BUYER') return 'Tài khoản hiện tại không phải buyer.'
  if (message === 'USER_HAS_NO_COMPANY') return 'Tài khoản chưa gắn với công ty.'
  if (message === 'COMPANY_NOT_FOUND') return 'Không tìm thấy công ty của tài khoản hiện tại.'
  if (message === 'PRODUCT_NOT_FOUND') return 'Không tìm thấy sản phẩm. Vui lòng chọn lại.'
  return message ?? fallback
}

function buildCreatePayload(form: RfqFormState): CreateBuyerRfqRequest {
  return {
    title: form.title.trim(),
    type: 'MARKETPLACE',
    productName: form.productName.trim() || form.title.trim(),
    supplierId: null,
    supplierCompanyId: null,
    productId: null,
    categoryId: optionalNumber(form.categoryId),
    branchId: optionalNumber(form.branchId),
    quantity: Number(form.quantity),
    unit: form.unit.trim(),
    province: form.province.trim() || null,
    deliveryDate: form.deliveryDate || null,
    expiredAt: new Date(form.expiredAt).toISOString(),
    description: form.description.trim() || null,
  }
}

function buildUpdatePayload(form: RfqFormState): UpdateBuyerRfqRequest {
  return {
    title: form.title.trim(),
    quantity: Number(form.quantity),
    unit: form.unit.trim(),
    province: form.province.trim() || null,
    deliveryDate: form.deliveryDate || null,
    expiredAt: form.expiredAt ? new Date(form.expiredAt).toISOString() : null,
    description: form.description.trim() || null,
    branchId: optionalNumber(form.branchId),
  }
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function RfqStatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, { badge: string; dot: string }> = {
    OPEN:      { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    QUOTED:    { badge: 'bg-blue-100 text-blue-700',        dot: 'bg-blue-500' },
    ACCEPTED:  { badge: 'bg-teal-100 text-teal-700',        dot: 'bg-teal-500' },
    CLOSED:    { badge: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400' },
    CANCELLED: { badge: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-400' },
    PENDING:   { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400' },
  }
  const cls = map[status ?? ''] ?? { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {rfqStatusLabel(status)}
    </span>
  )
}

function rfqStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    OPEN: 'Đang mở',
    QUOTED: 'Đã có báo giá',
    ACCEPTED: 'Đã chọn báo giá',
    CLOSED: 'Đã đóng',
    CANCELLED: 'Đã hủy',
    PENDING: 'Chờ xử lý',
    EXPIRED: 'Đã hết hạn',
  }
  return labels[String(status || '').toUpperCase()] || status || 'Chưa có'
}

function rfqOrderStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: 'Chờ xử lý',
    PENDING_SUPPLIER_CONFIRMATION: 'Chờ nhà cung cấp xác nhận',
    CONFIRMED: 'Đã xác nhận',
    SUPPLIER_CONFIRMED: 'Nhà cung cấp đã xác nhận',
    PREPARING: 'Đang chuẩn bị hàng',
    READY_TO_SHIP: 'Sẵn sàng giao',
    SHIPPING: 'Đang giao hàng',
    IN_DELIVERY: 'Đang giao hàng',
    DELIVERED: 'Đã giao hàng',
    COMPLETED: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
    DISPUTED: 'Đang khiếu nại',
  }
  return labels[String(status || '').toUpperCase()] || status || 'Chưa có'
}

function canCancel(status?: string | null) {
  const normalized = status?.toUpperCase()
  return normalized === 'OPEN' || normalized === 'QUOTED' || normalized === 'PENDING'
}

function canEdit(status?: string | null) {
  return canCancel(status)
}

function rfqCode(id?: number | null) {
  return `RFQ-${String(id ?? 0).padStart(6, '0')}`
}

function formatCurrency(value?: number | null) {
  if (value == null) return 'Chưa có'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

function formatNumber(value?: number | null) {
  if (value == null) return 'Chưa có'
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return date.toLocaleDateString('vi-VN')
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return date.toLocaleString('vi-VN')
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function toDateTimeInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16)
}

/* ─────────────────────────────────────────────────────────────────
   RfqSkeletonList — Loading UI xịn cho trang RFQ & Báo giá
   ──────────────────────────────────────────────────────────────── */

function RfqSkeletonBar({ className }: { className: string }) {
  return (
    <div
      className={`rounded-md ${className}`}
      style={{
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '400% 100%',
        animation: 'rfq-shimmer 1.6s ease-in-out infinite',
      }}
    />
  )
}

function RfqSkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
      style={{
        opacity: 0,
        animation: `rfq-fadein 0.35s ease forwards ${delay}s`,
      }}
    >
      {/* Top row: code + status badge + quote count + date */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <RfqSkeletonBar className="h-4 w-24" />
          <RfqSkeletonBar className="h-5 w-16 rounded-full" />
          <RfqSkeletonBar className="h-5 w-14 rounded-full" />
        </div>
        <div className="shrink-0 space-y-1 text-right">
          <RfqSkeletonBar className="ml-auto h-3 w-10" />
          <RfqSkeletonBar className="ml-auto h-4 w-20" />
        </div>
      </div>

      {/* Meta line */}
      <RfqSkeletonBar className="mt-1.5 h-3 w-32" />

      {/* 3-col info grid */}
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {[60, 48, 56].map((w, i) => (
          <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <RfqSkeletonBar className="mb-1.5 h-2.5 w-14" />
            <RfqSkeletonBar className={`h-3.5 w-${w === 60 ? '3/4' : w === 48 ? '1/2' : '2/3'}`} />
          </div>
        ))}
      </div>

      {/* Action button row */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <RfqSkeletonBar className="h-8 flex-1 min-w-[80px] rounded-xl" />
        <RfqSkeletonBar className="h-8 w-20 rounded-xl" />
        <RfqSkeletonBar className="h-8 w-14 rounded-xl" />
        <RfqSkeletonBar className="h-8 w-20 rounded-xl" />
        <RfqSkeletonBar className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  )
}

function RfqSkeletonList() {
  return (
    <div className="space-y-3">
      {/* Loading banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 shadow-sm">
        {/* Spinner */}
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20" />
          <span className="relative inline-flex h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-800">Đang tải yêu cầu báo giá...</p>
          <p className="text-xs font-medium text-emerald-600/70">Lấy danh sách RFQ và báo giá từ nhà cung cấp</p>
        </div>

        {/* Status pills */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {(['Đang mở', 'Đã báo giá', 'Đã chọn'] as const).map((label, i) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-emerald-600 backdrop-blur"
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Skeleton rows */}
      <div className="space-y-3">
        {[0, 0.08, 0.16, 0.24].map((delay, i) => (
          <RfqSkeletonRow key={i} delay={delay} />
        ))}
      </div>

      <style>{`
        @keyframes rfq-shimmer {
          0%   { background-position: 100% 50%; }
          100% { background-position: 0%   50%; }
        }
        @keyframes rfq-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  )
}
