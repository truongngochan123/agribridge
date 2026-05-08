import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { BuyerPanel, SearchInput } from '../../components/buyer/BuyerCommon'
import { BuyerShell } from '../../components/buyer/BuyerShell'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  cancelBuyerRfq,
  convertQuoteToOrder,
  createMarketplaceBuyerRfq,
  getBuyerRfqCompare,
  getBuyerRfqDetail,
  getBuyerRfqOrders,
  getBuyerRfqs,
  updateBuyerRfq,
} from '../../services/buyerRfqApi'
import { fetchBuyerBranches, type BuyerBranchSummary } from '../../services/buyerBranchService'
import { fetchCategories } from '../../services/supplierService'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import type { CategoryOption } from '../../types/supplierCreateFlow'
import type {
  BuyerQuoteCompareItem,
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
  const [searchParams] = useSearchParams()
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

  const [orders, setOrders] = useState<BuyerRfqOrderItem[]>([])
  const [ordersRfqId, setOrdersRfqId] = useState<number | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)

  const [formMode, setFormMode] = useState<RfqFormMode | null>(null)
  const [editingRfqId, setEditingRfqId] = useState<number | null>(null)
  const [form, setForm] = useState<RfqFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submittingCreate, setSubmittingCreate] = useState(false)
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [openedRfqParam, setOpenedRfqParam] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [branches, setBranches] = useState<BuyerBranchSummary[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)

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
    const firstBranch = branches[0]
    if (!firstBranch) return
    const deliveryLocation = firstBranch.deliveryAddress || firstBranch.address || firstBranch.province || ''
    setForm((prev) => ({
      ...prev,
      branchId: String(firstBranch.rawId),
      province: deliveryLocation || prev.province,
    }))
  }, [branches, form.branchId, form.province, formMode])

  
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
    if (!window.confirm('Bạn muốn chuyển báo giá này thành đơn hàng?')) return

    setConverting(true)
    try {
      const response = await convertQuoteToOrder(compareData.rfq.id, selectedQuoteId, {
        deliveryAddress: compareData.rfq.deliveryAddress || '',
        deliveryProvince: compareData.rfq.province || '',
        note: 'Tạo đơn từ báo giá đã chọn',
        createInvoice: true,
      })
      alert(`Đã chuyển báo giá thành đơn hàng. Order #${response.orderId}${response.invoiceId ? `, Invoice #${response.invoiceId}` : ''}`)
      setCompareData(null)
      setSelectedQuoteId(null)
      await loadRfqs()
    } catch (error) {
      setCompareError(formatBuyerRfqError(error, 'Không thể chuyển báo giá thành đơn hàng'))
    } finally {
      setConverting(false)
    }
  }

  const formTitle = formMode === 'create' ? 'Tạo RFQ mới' : 'Sửa RFQ'
  const formSubmitting = submittingCreate || submittingUpdate

  return (
    <>
      <BuyerShell
        activeKey="rfq"
        title="RFQ & Báo giá"
        subtitle="Quản lý yêu cầu báo giá và so sánh"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
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
              <option value="OPEN">OPEN</option>
              <option value="QUOTED">QUOTED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
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
          {loadingList && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              Đang tải RFQ...
            </div>
          )}
          {listError && !loadingList && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {listError}
              <button className="ml-2 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white" onClick={loadRfqs}>Thử lại</button>
            </div>
          )}
          {!loadingList && !listError && rfqs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">Chưa có yêu cầu báo giá nào</p>
            </div>
          )}

          <div className="space-y-3">
            {rfqs.map((item) => (
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
          branches={branches}
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
}: {
  data: BuyerRfqCompareResponse
  error: string | null
  selectedQuoteId: number | null
  converting: boolean
  onSelect: (quoteId: number) => void
  onClose: () => void
  onConvert: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-3 max-h-[92vh] w-[96vw] max-w-[1180px] overflow-y-auto rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 p-3">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">So sánh báo giá - {data.rfq.code || rfqCode(data.rfq.id)}</h3>
            <p className="mt-0.5 text-xs text-slate-600">{data.rfq.product || 'Chưa có sản phẩm'} - {formatNumber(data.rfq.quantity)} {data.rfq.unit || ''}</p>
          </div>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>x</button>
        </div>

        <div className="grid gap-2 border-b border-slate-200 p-3 text-xs md:grid-cols-4">
          <p>Giá mục tiêu: <span className="font-bold">{data.rfq.targetPrice == null ? 'Chưa đặt' : formatCurrency(data.rfq.targetPrice)}</span></p>
          <p>Hạn chót: <span className="font-bold">{formatDate(data.rfq.deadline)}</span></p>
          <p>Địa chỉ giao: <span className="font-bold">{data.rfq.deliveryAddress || data.rfq.province || 'Chưa có'}</span></p>
          <p>Nhận: <span className="font-bold text-emerald-700">{data.quotes.length} báo giá</span></p>
        </div>

        {error ? <p className="mx-3 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        {data.quotes.length === 0 ? (
          <StateBox text="Chưa có báo giá nào cho RFQ này" />
        ) : (
          <div className="grid gap-2 p-3 lg:grid-cols-3">
            {data.quotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} checked={selectedQuoteId === quote.id} onSelect={() => onSelect(quote.id)} />
            ))}
          </div>
        )}

        <div className="flex justify-between border-t border-slate-200 p-3">
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700" onClick={onClose}>Đóng</button>
          <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500" disabled={!selectedQuoteId || converting} onClick={onConvert}>
            {converting ? 'Đang chuyển...' : 'Chuyển thành đơn hàng'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuoteCard({ quote, checked, onSelect }: { quote: BuyerQuoteCompareItem; checked: boolean; onSelect: () => void }) {
  return (
    <article className="rounded-xl border border-slate-200 p-2.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-extrabold text-slate-900">{quote.supplierName || 'Nhà cung cấp'}</p>
          <p className="text-xs text-slate-500">
            {quote.supplierRating == null ? 'Chưa có đánh giá' : `${quote.supplierRating}/5`} {quote.supplierOrderCount ? `(${quote.supplierOrderCount} đơn)` : ''}
          </p>
        </div>
        <input type="radio" name="selectedQuote" checked={checked} onChange={onSelect} className="mt-1.5 h-4 w-4 accent-emerald-600" />
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(quote.tags ?? []).map((tag) => (
          <span key={tag} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{tag}</span>
        ))}
      </div>

      <div className="mt-2 rounded-lg bg-blue-50 p-2 text-center">
        <p className="text-[28px] font-extrabold text-blue-600">{formatCurrency(quote.price)}</p>
        <p className="text-xs">per kg</p>
        <p className="text-xs text-slate-500">Tổng: {formatCurrency(quote.total)}</p>
      </div>

      <div className="mt-2 space-y-1 text-xs">
        <InfoRow label="Mã lô" value={quote.batchCode || 'Chưa có'} />
        <InfoRow label="Grade/Size" value={quote.gradeSize || 'Chưa có'} />
        <InfoRow label="Thu hoạch" value={formatDate(quote.harvestDate)} />
        <InfoRow label="Giao hàng" value={formatDate(quote.estimatedDeliveryDate)} />
        <InfoRow label="Thời gian" value={quote.deliveryDays == null ? 'Chưa có' : `${quote.deliveryDays} ngày`} />
        <InfoRow label="Phí ship" value={quote.shippingFee == null ? 'Chưa cập nhật' : formatCurrency(quote.shippingFee)} />
        <InfoRow label="Thanh toán" value={quote.paymentTerm || quote.note || 'Chưa có'} />
        <InfoRow label="Trạng thái" value={quote.status || 'Chưa có'} />
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
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>x</button>
        </div>
        {loading ? <StateBox text="Đang tải chi tiết RFQ..." /> : null}
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        {detail ? (
          <>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <InfoRow label="Mã RFQ" value={detail.code || rfqCode(detail.id)} />
              <InfoRow label="Trạng thái" value={detail.status || 'Chưa có'} />
              <InfoRow label="Tiêu đề" value={detail.title || 'Chưa có'} />
              <InfoRow label="Sản phẩm" value={detail.product || 'Chưa có'} />
              <InfoRow label="Product ID" value={String(detail.productId ?? 'Chưa có')} />
              <InfoRow label="Category ID" value={String(detail.categoryId ?? 'Chưa có')} />
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
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={onClose}>Đóng</button>
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
  branches,
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
  branches: BuyerBranchSummary[]
  submitting: boolean
  onChange: (form: RfqFormState) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const setField = (field: keyof RfqFormState, value: string) => onChange({ ...form, [field]: value })
  return (
    <div className="fixed inset-0 z-[90] bg-black/35 p-4" onClick={onClose}>
      <div className="mx-auto mt-6 max-h-[92vh] w-[94vw] max-w-2xl overflow-y-auto rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>x</button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        {optionsError ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{optionsError}</p> : null}
        {optionsLoading ? <p className="mt-2 text-xs font-semibold text-slate-500">Đang tải danh sách danh mục/chi nhánh...</p> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FormField label="Tiêu đề *" value={form.title} onChange={(value) => setField('title', value)} />
          <FormField label="Sản phẩm cần mua *" value={form.productName} onChange={(value) => setField('productName', value)} />
          <SelectField
            label="Danh mục *"
            value={form.categoryId}
            onChange={(value) => setField('categoryId', value)}
            placeholder="Chọn danh mục"
            options={categories.map((item) => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
          <FormField label="Số lượng *" type="number" value={form.quantity} onChange={(value) => setField('quantity', value)} />
          <FormField label="Đơn vị *" value={form.unit} onChange={(value) => setField('unit', value)} />
          <FormField label="Địa điểm giao hàng *" value={form.province} onChange={(value) => setField('province', value)} />
          <FormField label="Ngày giao mong muốn *" type="date" value={form.deliveryDate} onChange={(value) => setField('deliveryDate', value)} />
          <FormField label="Hạn nhận báo giá *" type="datetime-local" value={form.expiredAt} onChange={(value) => setField('expiredAt', value)} />
          <label className="md:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Mô tả / Yêu cầu thêm</span>
            <textarea value={form.description} onChange={(event) => setField('description', event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700" onClick={onClose} disabled={submitting}>Đóng</button>
          <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" onClick={onSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu RFQ'}</button>
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
          <button className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={onClose}>x</button>
        </div>
        {loading ? <StateBox text="Đang tải đơn hàng..." /> : null}
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        {!loading && !error && orders.length === 0 ? <StateBox text="RFQ này chưa được chuyển thành đơn hàng" /> : null}
        <div className="mt-3 space-y-2">
          {orders.map((order) => (
            <article key={order.orderId} className="rounded-lg border border-slate-200 p-3 text-sm">
              <InfoRow label="Order ID" value={String(order.orderId)} />
              <InfoRow label="Quote ID" value={String(order.quoteId ?? 'Chưa có')} />
              <InfoRow label="Supplier" value={order.supplierName || 'Chưa có'} />
              <InfoRow label="Tổng tiền" value={formatCurrency(order.totalAmount)} />
              <InfoRow label="Trạng thái" value={order.orderStatus || 'Chưa có'} />
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

function FormField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
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
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        <button className="mt-4 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white" onClick={onClose}>Đóng</button>
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
      {status || 'N/A'}
    </span>
  )
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
