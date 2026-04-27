import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Flame,
  Layers,
  Loader2,
  Package2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Video,
  X,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BatchFormFields, EMPTY_BATCH_FORM, type BatchFormState } from '../../components/supplier/BatchFormFields'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useToast } from '../../hooks/useToast'
import {
  createBatchForExistingProduct,
  deleteSupplierBatch,
  getProductBatches,
  getSupplierBatchDetail,
  getSupplierProductDetail,
  updateSupplierBatch,
} from '../../services/supplierService'
import { resolveUploadedFileUrl, uploadBatchVideo, uploadSupplierDocument } from '../../services/uploadService'
import type {
  CreateBatchForProductRequest,
  CreateBatchPayload,
  SupplierBatchCard,
  SupplierBatchDetail,
  SupplierProductDetail,
  UpdateBatchRequest,
} from '../../types/supplierCreateFlow'
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'

type BatchForm = BatchFormState

const MAX_BATCH_VIDEO_SIZE_BYTES = 95 * 1024 * 1024

function toStorageValue(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace('Â°C', '').trim()
}

function toStorageLabel(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  return `${normalized}Â°C`
}

function toAbsoluteUploadedUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  if (!trimmed) return undefined
  return resolveUploadedFileUrl(trimmed) || trimmed
}

function deriveLotStatus(quantity: number): 'con-hang' | 'sap-het' | 'het-hang' {
  if (quantity <= 0) return 'het-hang'
  if (quantity <= 100) return 'sap-het'
  return 'con-hang'
}

function stockLabel(status: 'con-hang' | 'sap-het' | 'het-hang'): string {
  if (status === 'con-hang') return 'Còn hàng'
  if (status === 'sap-het') return 'Đang bán'
  return 'Đã hết'
}

function stockBadgeStyle(status: 'con-hang' | 'sap-het' | 'het-hang'): string {
  if (status === 'con-hang')
    return 'bg-emerald-500/10 text-emerald-700 border border-emerald-300/60 ring-1 ring-emerald-400/20'
  if (status === 'sap-het')
    return 'bg-amber-500/10 text-amber-700 border border-amber-300/60 ring-1 ring-amber-400/20'
  return 'bg-rose-500/10 text-rose-600 border border-rose-300/60 ring-1 ring-rose-400/20'
}

function batchStateLabel(value?: string | null): string {
  const normalized = value?.trim()
  if (!normalized) return 'Đang bán'
  return normalized
}

function batchStateStyle(value?: string | null): string {
  const normalized = (value || '').toLowerCase()
  if (normalized.includes('đóng') || normalized.includes('dong') || normalized.includes('closed')) {
    return 'bg-slate-100 text-slate-600 border border-slate-200'
  }
  if (normalized.includes('hết') || normalized.includes('het')) {
    return 'bg-rose-100 text-rose-600 border border-rose-200'
  }
  return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
}

function formatDateLabel(value?: string | null): string {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('vi-VN')
}

function formatPriceLabel(value: number, unit: string): string {
  return `${value.toLocaleString('vi-VN')}đ/${unit}`
}

export function SupplierLotListPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { showToast, showConfirm } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingQcFile, setUploadingQcFile] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingBatchImage, setUploadingBatchImage] = useState(false)

  const [product, setProduct] = useState<SupplierProductDetail | null>(null)
  const [batches, setBatches] = useState<SupplierBatchCard[]>([])
  const [batchDetailsById, setBatchDetailsById] = useState<Record<number, SupplierBatchDetail>>({})

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<BatchForm>(EMPTY_BATCH_FORM)

  const [openCreateModal, setOpenCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<BatchForm>(EMPTY_BATCH_FORM)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [timeFilter, setTimeFilter] = useState<'all' | '7d' | '30d' | '90d'>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'con-hang' | 'sap-het' | 'het-hang'>('all')
  const [gradeFilter, setGradeFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')

  const parsedProductId = Number(productId)
  const userId = Number(sessionStorage.getItem('agribridge.auth.userId') ?? 0)

  const loadData = useCallback(async () => {
    if (!parsedProductId) {
      showToast('Thiếu productId hợp lệ.', 'error')
      return
    }

    setLoading(true)
    try {
      const [productResult, batchResult] = await Promise.allSettled([
        getSupplierProductDetail(parsedProductId),
        getProductBatches(parsedProductId),
      ])

      setProduct(productResult.status === 'fulfilled' ? productResult.value : null)
      setBatches(batchResult.status === 'fulfilled' ? batchResult.value : [])

      if (productResult.status === 'rejected' && batchResult.status === 'rejected') {
        showToast('Không thể tải danh sách lô hàng.', 'error')
      } else if (productResult.status === 'rejected') {
        showToast('Không thể tải chi tiết sản phẩm.', 'error')
      }
    } catch {
      showToast('Không thể tải danh sách lô hàng.', 'error')
    } finally {
      setLoading(false)
    }
  }, [parsedProductId, showToast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (batches.length === 0) {
      setBatchDetailsById({})
      return
    }

    let isCancelled = false

    void (async () => {
      const results = await Promise.allSettled(batches.map((batch) => getSupplierBatchDetail(batch.id)))
      if (isCancelled) return

      const next: Record<number, SupplierBatchDetail> = {}
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          next[result.value.id] = result.value
        }
      })
      setBatchDetailsById(next)
    })()

    return () => {
      isCancelled = true
    }
  }, [batches])

  const filteredBatches = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    const now = new Date()

    return batches.filter((batch) => {
      const lotStatus = deriveLotStatus(Number(batch.quantity || 0))

      if (keyword) {
        const byCode = (batch.batchCode || '').toLowerCase().includes(keyword)
        const byProduct = (batch.productName || product?.name || '').toLowerCase().includes(keyword)
        if (!byCode && !byProduct) return false
      }

      if (stockFilter !== 'all' && lotStatus !== stockFilter) return false
      if (gradeFilter !== 'all' && (batch.grade || '').toUpperCase() !== gradeFilter) return false
      if (timeFilter === 'all') return true

      const dateValue = batch.harvestDate || batch.expiryDate
      if (!dateValue) return false

      const target = new Date(dateValue)
      if (Number.isNaN(target.getTime())) return false

      const diffDays = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
      if (timeFilter === '7d') return diffDays <= 7
      if (timeFilter === '30d') return diffDays <= 30
      return diffDays <= 90
    })
  }, [batches, gradeFilter, product?.name, searchKeyword, stockFilter, timeFilter])

  const summary = useMemo(() => {
    const total = batches.length
    const active = batches.filter((batch) => Number(batch.quantity || 0) > 0).length
    const closed = total - active
    return { total, active, closed }
  }, [batches])

  const handleDelete = async (batchId: number) => {
    const confirmed = await showConfirm('Bạn có chắc muốn xóa lô hàng này?', {
      title: 'Xác nhận xóa lô hàng',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
    })
    if (!confirmed) return

    try {
      await deleteSupplierBatch(batchId)
      await loadData()
      showToast('Đã xóa lô hàng thành công.', 'success')
    } catch (error) {
      showToast(readApiErrorMessage(error) || 'Không thể xóa lô hàng.', 'error')
    }
  }

  const openEdit = async (batchId: number) => {
    try {
      const batchDetail = await getSupplierBatchDetail(batchId)
      setEditingBatchId(batchDetail.id)
      setEditForm({
        harvestDate: batchDetail.harvestDate,
        expiryDate: batchDetail.expiryDate ?? '',
        grade: (batchDetail.grade as 'A' | 'B' | 'C') || '',
        size: batchDetail.size ?? '',
        quantity: String(batchDetail.quantity ?? ''),
        price: String(batchDetail.price ?? ''),
        moq: String(batchDetail.moq ?? ''),
        storageTempValue: toStorageValue(batchDetail.storageTemp),
        videoUrl: batchDetail.videoUrl ?? '',
        imageUrls: batchDetail.imageUrls ?? [],
        qcResult: (batchDetail.qcResult as 'PASS' | 'FAIL') || '',
        qcDocumentUrl: batchDetail.qcDocumentUrl ?? '',
        qcNotes: batchDetail.qcNotes ?? '',
      })
    } catch {
      showToast('Không thể tải dữ liệu để sửa lô hàng.', 'error')
    }
  }

  const validateBatchForm = (form: BatchForm): boolean => {
    if (!form.harvestDate) {
      showToast('Ngày thu hoạch là bắt buộc.', 'error')
      return false
    }

    const today = new Date().toISOString().slice(0, 10)
    if (form.harvestDate > today) {
      showToast('Ngày thu hoạch không được ở tương lai.', 'error')
      return false
    }

    if (form.expiryDate && form.expiryDate < today) {
      showToast('Ngày hết hạn không được ở quá khứ.', 'error')
      return false
    }

    if (form.expiryDate && form.expiryDate <= form.harvestDate) {
      showToast('Ngày hết hạn phải sau ngày thu hoạch.', 'error')
      return false
    }

    if (!form.grade) {
      showToast('Grade là bắt buộc.', 'error')
      return false
    }

    if (!form.quantity || Number(form.quantity) <= 0) {
      showToast('Tồn kho phải lớn hơn 0.', 'error')
      return false
    }

    if (!form.price || Number(form.price) <= 0) {
      showToast('Giá phải lớn hơn 0.', 'error')
      return false
    }

    if (!form.qcResult) {
      showToast('Kết quả QC là bắt buộc.', 'error')
      return false
    }

    if (form.qcResult === 'PASS' && !form.qcDocumentUrl.trim()) {
      showToast('PASS bắt buộc có file kiểm định.', 'error')
      return false
    }

    if (form.qcResult === 'FAIL' && !form.qcNotes.trim()) {
      showToast('FAIL bắt buộc có ghi chú kiểm định.', 'error')
      return false
    }

    return true
  }

  const toBatchPayload = (form: BatchForm): CreateBatchPayload => {
    const storageTemp = toStorageLabel(form.storageTempValue)

    return {
      harvestDate: form.harvestDate,
      expiryDate: form.expiryDate || undefined,
      grade: form.grade as 'A' | 'B' | 'C',
      size: form.size.trim() || undefined,
      quantity: Number(form.quantity),
      price: Number(form.price),
      moq: form.moq ? Number(form.moq) : 0,
      storageTemp: storageTemp || undefined,
      videoUrl: toAbsoluteUploadedUrl(form.videoUrl),
      qc: {
        result: form.qcResult as 'PASS' | 'FAIL',
        documentUrl: toAbsoluteUploadedUrl(form.qcDocumentUrl),
        notes: form.qcNotes.trim() || undefined,
      },
    }
  }

  const submitEditBatch = async () => {
    if (!editingBatchId) return
    if (!validateBatchForm(editForm) || !userId) return

    const payload: UpdateBatchRequest = {
      userId,
      batch: toBatchPayload(editForm),
    }

    setSubmitting(true)
    try {
      await updateSupplierBatch(editingBatchId, payload)
      setEditingBatchId(null)
      setEditForm(EMPTY_BATCH_FORM)
      showToast('Cập nhật lô hàng thành công.', 'success')
      await loadData()
    } catch {
      showToast('Cập nhật lô hàng thất bại.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCreateBatch = async () => {
    if (!parsedProductId) {
      showToast('Không xác định được sản phẩm hiện tại.', 'error')
      return
    }

    if (!validateBatchForm(createForm) || !userId) return

    const payload: CreateBatchForProductRequest = {
      productId: parsedProductId,
      userId,
      batch: toBatchPayload(createForm),
    }

    setSubmitting(true)
    try {
      await createBatchForExistingProduct(payload)
      setOpenCreateModal(false)
      setCreateForm(EMPTY_BATCH_FORM)
      showToast('Tạo lô hàng thành công.', 'success')
      await loadData()
    } catch {
      showToast('Tạo lô hàng thất bại.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const uploadQcDocument = async (file: File, forCreate: boolean) => {
    setUploadingQcFile(true)
    try {
      const uploaded = await uploadSupplierDocument(file)
      if (forCreate) {
        setCreateForm((prev) => ({ ...prev, qcDocumentUrl: uploaded.url }))
      } else {
        setEditForm((prev) => ({ ...prev, qcDocumentUrl: uploaded.url }))
      }
    } catch {
      showToast('Upload file QC thất bại.', 'error')
    } finally {
      setUploadingQcFile(false)
    }
  }

  const uploadBatchImageDocument = async (file: File, forCreate: boolean) => {
    setUploadingBatchImage(true)
    try {
      const uploaded = await uploadSupplierDocument(file)
      if (!uploaded.url) {
        throw new Error('missing image url')
      }

      const applyImage = (prev: BatchForm) => {
        if (prev.imageUrls.includes(uploaded.url)) {
          return prev
        }

        return { ...prev, imageUrls: [...prev.imageUrls, uploaded.url] }
      }

      if (forCreate) {
        setCreateForm(applyImage)
      } else {
        setEditForm(applyImage)
      }
    } catch {
      showToast('Upload hình ảnh lô hàng thất bại.', 'error')
    } finally {
      setUploadingBatchImage(false)
    }
  }

  const uploadVideoDocument = async (file: File, forCreate: boolean) => {
    if (!file.type.startsWith('video/')) {
      showToast('Vui lòng chọn đúng định dạng video.', 'error')
      return
    }

    if (file.size > MAX_BATCH_VIDEO_SIZE_BYTES) {
      showToast('Video vượt quá 95MB, vui lòng chọn file nhỏ hơn.', 'error')
      return
    }

    setUploadingVideo(true)
    try {
      const uploaded = await uploadBatchVideo(file)
      if (forCreate) {
        setCreateForm((prev) => ({ ...prev, videoUrl: uploaded.url }))
      } else {
        setEditForm((prev) => ({ ...prev, videoUrl: uploaded.url }))
      }
    } catch (error) {
      if (error instanceof Error && error.message) {
        showToast(error.message, 'error')
      } else {
        showToast('Upload video thất bại.', 'error')
      }
    } finally {
      setUploadingVideo(false)
    }
  }

  const avgPrice = batches.length > 0
    ? Math.round(batches.reduce((sum, b) => sum + Number(b.price || 0), 0) / batches.length)
    : 0

  return (
    <>
      <SupplierShell activeKey="products" title="Danh sách lô hàng" subtitle="">
        {/* flex-col + h-full lets us make only the list scroll */}
        <div className="flex h-full flex-col gap-3">

          {/* ── Compact Header (sticky) ── */}
          <div className="shrink-0 space-y-2">
            {/* Row 1: product info + stats + price + action */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-500 px-4 py-2.5 shadow-md">
              {/* Back */}
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                onClick={() => navigate('/supplier/products')}
                aria-label="Quay về sản phẩm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>

              {/* Thumbnail */}
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/30">
                <img
                  src={resolveUploadedFileUrl(product?.imageUrls?.[0] || '') || 'https://placehold.co/80x80?text=Lot'}
                  alt={product?.name || 'product'}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Name + province */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{product?.name || 'Danh sách lô hàng'}</p>
                <p className="text-[10px] text-white/60">{product?.originProvince ?? ''}{product?.unit ? ` · ${product.unit}` : ''}</p>
              </div>

              {/* Stat chips */}
              <div className="flex items-center gap-1.5">
                <StatChip icon={<Layers className="h-3 w-3" />} label="Tổng lô" value={summary.total} color="white" />
                <StatChip icon={<Flame className="h-3 w-3" />} label="Đang bán" value={summary.active} color="emerald" />
                <StatChip icon={<Package2 className="h-3 w-3" />} label="Đã hết" value={summary.closed} color="rose" />
              </div>

              {/* Avg price */}
              <div className="hidden text-right sm:block">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Giá TB</p>
                <p className="text-sm font-black text-white">
                  {avgPrice > 0 ? avgPrice.toLocaleString('vi-VN') + 'đ' : '--'}
                  <span className="ml-0.5 text-[10px] font-semibold text-white/60">/{product?.unit || 'kg'}</span>
                </p>
              </div>

              {/* Create button */}
              <button
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow transition hover:bg-emerald-50 active:scale-95"
                onClick={() => {
                  setCreateForm(EMPTY_BATCH_FORM)
                  setOpenCreateModal(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo lô mới
              </button>
            </div>

            {/* Row 2: Filter bar */}
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm">
              <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_140px_150px_130px]">
                <label className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Tìm theo mã lô hoặc tên..."
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                    className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-2 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
                  >
                    <option value="all">Tất cả thời gian</option>
                    <option value="7d">7 ngày gần đây</option>
                    <option value="30d">30 ngày gần đây</option>
                    <option value="90d">90 ngày gần đây</option>
                  </select>
                </label>

                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                  className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="all">Trạng thái: Tất cả</option>
                  <option value="con-hang">Còn hàng</option>
                  <option value="sap-het">Đang bán</option>
                  <option value="het-hang">Đã hết</option>
                </select>

                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value as typeof gradeFilter)}
                  className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="all">Grade: Tất cả</option>
                  <option value="A">Grade A</option>
                  <option value="B">Grade B</option>
                  <option value="C">Grade C</option>
                </select>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                Hiển thị <span className="font-bold text-emerald-600">{filteredBatches.length}</span>/{batches.length} lô hàng
              </p>
            </div>
          </div>

          {loading ? (
            <div className="shrink-0 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              Đang tải dữ liệu...
            </div>
          ) : null}

          {/* ── Batch Cards (scrollable) ── */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredBatches.map((batch) => {
              const lotStatus = deriveLotStatus(Number(batch.quantity || 0))
              const batchDetail = batchDetailsById[batch.id]
              const previewImages = [batch.imageUrl, ...(batchDetail?.imageUrls ?? []), ...(product?.imageUrls ?? [])]
                .map((url) => resolveUploadedFileUrl(url || '') || '')
                .filter((url, idx, list) => Boolean(url) && list.indexOf(url) === idx)
                .slice(0, 4)

              return (
                <article
                  key={batch.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-emerald-200 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]"
                >
                  {/* Left accent bar */}
                  <div
                    className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${
                      lotStatus === 'con-hang'
                        ? 'bg-emerald-500'
                        : lotStatus === 'sap-het'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />

                  <div className="pl-5 pr-4 py-4">
                    {/* Row 1: Code + badges + actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                          {batch.batchCode || `BATCH-${batch.id}`}
                        </h3>
                        <Badge className={stockBadgeStyle(lotStatus)}>{stockLabel(lotStatus)}</Badge>
                        <Badge className={batchStateStyle(batch.status)}>{batchStateLabel(batch.status)}</Badge>
                        <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Grade {batch.grade || 'N/A'}</Badge>
                        {batchDetail?.qcResult === 'PASS' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> QC PASS
                          </Badge>
                        ) : batchDetail?.qcResult === 'FAIL' ? (
                          <Badge className="bg-rose-50 text-rose-600 border border-rose-200 inline-flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> QC FAIL
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border border-slate-200">QC N/A</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {batchDetail?.qcDocumentUrl ? (
                          <a
                            href={resolveUploadedFileUrl(batchDetail.qcDocumentUrl) || batchDetail.qcDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                            title="Mở file kiểm định QC"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <button
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95"
                          onClick={() => void openEdit(batch.id)}
                        >
                          Sửa
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                          onClick={() => void handleDelete(batch.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa lô
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Images */}
                    <div className="mt-3 flex items-center gap-2">
                      {previewImages.length > 0 ? (
                        previewImages.map((url) => (
                          <button
                            key={url}
                            type="button"
                            className="overflow-hidden rounded-lg border border-slate-200 transition hover:scale-105 hover:border-emerald-300 hover:shadow-md"
                            onClick={() => setPreviewImageUrl(url)}
                          >
                            <img src={url} alt="batch-preview" className="h-12 w-12 object-cover" />
                          </button>
                        ))
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                          Ảnh
                        </div>
                      )}
                      {previewImages.length > 0 && (
                        <span className="text-[11px] text-slate-400">{previewImages.length} ảnh</span>
                      )}
                    </div>

                    {/* Row 3: Metrics */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                      <MetricChip label="Thu hoạch" value={formatDateLabel(batch.harvestDate)} />
                      <MetricChip label="Hạn dùng" value={formatDateLabel(batch.expiryDate)} />
                      <MetricChip label="Size" value={batch.size || '--'} />
                      <MetricChip label="Nhiệt độ" value={batchDetail?.storageTemp || '--'} />
                      <MetricChip label="Giá bán" value={formatPriceLabel(batch.price, product?.unit || 'kg')} highlight />
                      <MetricChip label="Tồn kho" value={`${batch.quantity} ${product?.unit || ''}`.trim()} />
                      <MetricChip label="MOQ" value={`${batch.moq} ${product?.unit || ''}`.trim()} />
                      <VideoChip url={batchDetail?.videoUrl || ''} />
                    </div>

                    {/* Row 4: QC Notes */}
                    {batchDetail?.qcNotes?.trim() && (
                      <div className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/70 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Ghi chú kiểm định</p>
                        <p className="mt-0.5 text-xs text-amber-800">{batchDetail.qcNotes.trim()}</p>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}

            {!loading && filteredBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
                <Package2 className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">Không có lô hàng phù hợp</p>
                <p className="mt-1 text-xs text-slate-400">Thử thay đổi bộ lọc hoặc tạo lô hàng mới</p>
              </div>
            ) : null}
          </div>
        </div>
      </SupplierShell>



      {/* ── Image Preview ── */}
      {previewImageUrl ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            onClick={() => setPreviewImageUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImageUrl}
            alt="preview-large"
            className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {/* ── Create Modal ── */}
      {openCreateModal ? (
        <BatchModal
          title="Tạo lô hàng mới"
          form={createForm}
          setForm={setCreateForm}
          unit={product?.unit || 'kg'}
          submitting={submitting}
          uploadingQcFile={uploadingQcFile}
          uploadingVideo={uploadingVideo}
          uploadingBatchImage={uploadingBatchImage}
          onClose={() => setOpenCreateModal(false)}
          onSubmit={() => void submitCreateBatch()}
          onUploadQc={(file) => void uploadQcDocument(file, true)}
          onUploadVideo={(file) => void uploadVideoDocument(file, true)}
          onUploadBatchImage={(file) => void uploadBatchImageDocument(file, true)}
        />
      ) : null}

      {/* ── Edit Modal ── */}
      {editingBatchId ? (
        <BatchModal
          title="Sửa lô hàng"
          form={editForm}
          setForm={setEditForm}
          unit={product?.unit || 'kg'}
          submitting={submitting}
          uploadingQcFile={uploadingQcFile}
          uploadingVideo={uploadingVideo}
          uploadingBatchImage={uploadingBatchImage}
          onClose={() => {
            setEditingBatchId(null)
            setEditForm(EMPTY_BATCH_FORM)
          }}
          onSubmit={() => void submitEditBatch()}
          onUploadQc={(file) => void uploadQcDocument(file, false)}
          onUploadVideo={(file) => void uploadVideoDocument(file, false)}
          onUploadBatchImage={(file) => void uploadBatchImageDocument(file, false)}
        />
      ) : null}
    </>
  )
}

/* ─────────────────────────── Sub-components ─────────────────────────── */

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${className ?? ''}`}>
      {children}
    </span>
  )
}

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'white' | 'emerald' | 'rose'
}) {
  const cls =
    color === 'emerald'
      ? 'bg-emerald-500/20 text-white border border-emerald-400/30'
      : color === 'rose'
      ? 'bg-rose-500/20 text-white border border-rose-400/30'
      : 'bg-white/15 text-white border border-white/20'

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur-sm ${cls}`}>
      {icon}
      <span className="opacity-80">{label}</span>
      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{value}</span>
    </div>
  )
}

function MetricChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

function VideoChip({ url }: { url?: string | null }) {
  const resolvedUrl = resolveUploadedFileUrl(url || '') || url || ''

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Video</p>
      {resolvedUrl ? (
        <a
          href={resolvedUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold text-rose-500 transition hover:text-rose-600"
        >
          <Video className="h-3.5 w-3.5" /> Xem
        </a>
      ) : (
        <p className="mt-0.5 text-sm font-bold text-slate-300">--</p>
      )}
    </div>
  )
}

function BatchModal({
  title,
  form,
  setForm,
  unit,
  submitting,
  uploadingQcFile,
  uploadingVideo,
  uploadingBatchImage,
  onClose,
  onSubmit,
  onUploadQc,
  onUploadVideo,
  onUploadBatchImage,
}: {
  title: string
  form: BatchForm
  setForm: React.Dispatch<React.SetStateAction<BatchForm>>
  unit: string
  submitting: boolean
  uploadingQcFile: boolean
  uploadingVideo: boolean
  uploadingBatchImage: boolean
  onClose: () => void
  onSubmit: () => void
  onUploadQc: (file: File) => void
  onUploadVideo: (file: File) => void
  onUploadBatchImage: (file: File) => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="my-4 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <BatchFormFields
            form={form}
            setForm={setForm}
            unit={unit}
            uploadingQcFile={uploadingQcFile}
            uploadingVideo={uploadingVideo}
            uploadingBatchImage={uploadingBatchImage}
            showBatchImages
            onUploadQc={onUploadQc}
            onUploadVideo={onUploadVideo}
            onUploadBatchImage={onUploadBatchImage}
          />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 hover:shadow-lg disabled:opacity-50 active:scale-95"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lưu lô hàng
          </button>
        </div>
      </div>
    </div>
  )
}
