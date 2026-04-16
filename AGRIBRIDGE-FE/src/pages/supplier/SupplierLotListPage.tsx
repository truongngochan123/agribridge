import { ArrowLeft, CalendarDays, Eye, ExternalLink, Loader2, Search, Trash2, Upload, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import {
  createBatchForExistingProduct,
  deleteSupplierBatch,
  getProductBatches,
  getSupplierBatchDetail,
  getSupplierProductDetail,
  updateSupplierBatch,
} from '../../services/supplierService'
import { uploadBatchVideo, uploadSupplierDocument } from '../../services/uploadService'
import type {
  CreateBatchForProductRequest,
  CreateBatchPayload,
  SupplierBatchCard,
  SupplierBatchDetail,
  SupplierProductDetail,
  UpdateBatchRequest,
} from '../../types/supplierCreateFlow'

type BatchForm = {
  harvestDate: string
  expiryDate: string
  grade: 'A' | 'B' | 'C' | ''
  size: string
  quantity: string
  price: string
  moq: string
  storageTempValue: string
  videoUrl: string
  qcResult: 'PASS' | 'FAIL' | ''
  qcDocumentUrl: string
  qcNotes: string
}

const EMPTY_BATCH_FORM: BatchForm = {
  harvestDate: '',
  expiryDate: '',
  grade: '',
  size: '',
  quantity: '',
  price: '',
  moq: '',
  storageTempValue: '',
  videoUrl: '',
  qcResult: '',
  qcDocumentUrl: '',
  qcNotes: '',
}

function toStorageValue(value: string | null | undefined): string {
  if (!value) {
    return ''
  }
  return value.replace('°C', '').trim()
}

function toStorageLabel(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  return `${normalized}°C`
}

function deriveLotStatus(quantity: number): 'con-hang' | 'sap-het' | 'het-hang' {
  if (quantity <= 0) {
    return 'het-hang'
  }
  if (quantity <= 100) {
    return 'sap-het'
  }
  return 'con-hang'
}

function statusLabel(status: 'con-hang' | 'sap-het' | 'het-hang'): string {
  if (status === 'con-hang') return 'Còn hàng'
  if (status === 'sap-het') return 'Sắp hết'
  return 'Hết hàng'
}

function statusClass(status: 'con-hang' | 'sap-het' | 'het-hang'): string {
  if (status === 'con-hang') return 'bg-emerald-100 text-emerald-700'
  if (status === 'sap-het') return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

export function SupplierLotListPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingQcFile, setUploadingQcFile] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  const [message, setMessage] = useState('')
  const [product, setProduct] = useState<SupplierProductDetail | null>(null)
  const [batches, setBatches] = useState<SupplierBatchCard[]>([])

  const [detail, setDetail] = useState<SupplierBatchDetail | null>(null)
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<BatchForm>(EMPTY_BATCH_FORM)

  const [openCreateModal, setOpenCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<BatchForm>(EMPTY_BATCH_FORM)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [timeFilter, setTimeFilter] = useState<'all' | '7d' | '30d' | '90d'>('all')

  const parsedProductId = Number(productId)
  const userId = Number(sessionStorage.getItem('agribridge.auth.userId') ?? 0)

  const loadData = async () => {
    if (!parsedProductId) {
      setMessage('Thiếu productId hợp lệ.')
      return
    }

    setLoading(true)
    try {
      const [productResult, batchResult] = await Promise.allSettled([
        getSupplierProductDetail(parsedProductId),
        getProductBatches(parsedProductId),
      ])

      if (productResult.status === 'fulfilled') {
        setProduct(productResult.value)
      } else {
        setProduct(null)
      }

      if (batchResult.status === 'fulfilled') {
        setBatches(batchResult.value)
      } else {
        setBatches([])
      }

      if (productResult.status === 'rejected' && batchResult.status === 'rejected') {
        setMessage('Không thể tải danh sách lô hàng.')
      } else if (productResult.status === 'rejected') {
        setMessage('Không thể tải chi tiết sản phẩm, nhưng vẫn hiển thị được danh sách lô.')
      } else {
        setMessage('')
      }
    } catch {
      setMessage('Không thể tải danh sách lô hàng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [parsedProductId])

  const filteredBatches = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    const now = new Date()

    return batches.filter((batch) => {
      if (keyword) {
        const byCode = (batch.batchCode || '').toLowerCase().includes(keyword)
        const byProduct = (batch.productName || product?.name || '').toLowerCase().includes(keyword)
        if (!byCode && !byProduct) {
          return false
        }
      }

      if (timeFilter === 'all') {
        return true
      }

      const dateValue = batch.harvestDate || batch.expiryDate
      if (!dateValue) {
        return false
      }

      const target = new Date(dateValue)
      if (Number.isNaN(target.getTime())) {
        return false
      }

      const diffMs = now.getTime() - target.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      if (timeFilter === '7d') return diffDays <= 7
      if (timeFilter === '30d') return diffDays <= 30
      return diffDays <= 90
    })
  }, [batches, product?.name, searchKeyword, timeFilter])

  const handleDelete = async (batchId: number) => {
    const confirmed = window.confirm('Bạn có chắc muốn xóa lô hàng này?')
    if (!confirmed) {
      return
    }

    try {
      await deleteSupplierBatch(batchId)
      await loadData()
    } catch {
      setMessage('Không thể xóa lô hàng.')
    }
  }

  const openDetail = async (batchId: number) => {
    try {
      const batchDetail = await getSupplierBatchDetail(batchId)
      setDetail(batchDetail)
    } catch {
      setMessage('Không thể tải chi tiết lô hàng.')
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
        qcResult: (batchDetail.qcResult as 'PASS' | 'FAIL') || '',
        qcDocumentUrl: batchDetail.qcDocumentUrl ?? '',
        qcNotes: batchDetail.qcNotes ?? '',
      })
    } catch {
      setMessage('Không thể tải dữ liệu để sửa lô hàng.')
    }
  }

  const validateBatchForm = (form: BatchForm): boolean => {
    if (!form.harvestDate) {
      setMessage('Ngày thu hoạch/đánh bắt là bắt buộc.')
      return false
    }

    const today = new Date().toISOString().slice(0, 10)
    if (form.harvestDate > today) {
      setMessage('Ngày thu hoạch/đánh bắt không được ở tương lai.')
      return false
    }

    if (form.expiryDate && form.expiryDate < today) {
      setMessage('Ngày hết hạn không được ở quá khứ.')
      return false
    }

    if (form.expiryDate && form.expiryDate <= form.harvestDate) {
      setMessage('Ngày hết hạn phải sau ngày thu hoạch.')
      return false
    }

    if (!form.grade) {
      setMessage('Grade là bắt buộc.')
      return false
    }

    if (!form.quantity || Number(form.quantity) <= 0) {
      setMessage('Tồn kho phải lớn hơn 0.')
      return false
    }

    if (!form.price || Number(form.price) <= 0) {
      setMessage('Giá phải lớn hơn 0.')
      return false
    }

    if (!form.qcResult) {
      setMessage('Kết quả QC là bắt buộc.')
      return false
    }

    if (form.qcResult === 'PASS' && !form.qcDocumentUrl.trim()) {
      setMessage('PASS bắt buộc có file kiểm định.')
      return false
    }

    if (form.qcResult === 'FAIL' && !form.qcNotes.trim()) {
      setMessage('FAIL bắt buộc có ghi chú kiểm định.')
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
      videoUrl: form.videoUrl.trim() || undefined,
      qc: {
        result: form.qcResult as 'PASS' | 'FAIL',
        documentUrl: form.qcDocumentUrl.trim() || undefined,
        notes: form.qcNotes.trim() || undefined,
      },
    }
  }

  const submitEditBatch = async () => {
    if (!editingBatchId) {
      return
    }

    if (!validateBatchForm(editForm) || !userId) {
      return
    }

    const payload: UpdateBatchRequest = {
      userId,
      batch: toBatchPayload(editForm),
    }

    setSubmitting(true)
    try {
      await updateSupplierBatch(editingBatchId, payload)
      setEditingBatchId(null)
      setEditForm(EMPTY_BATCH_FORM)
      setMessage('Cập nhật lô hàng thành công.')
      await loadData()
    } catch {
      setMessage('Cập nhật lô hàng thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCreateBatch = async () => {
    if (!parsedProductId) {
      setMessage('Không xác định được sản phẩm hiện tại.')
      return
    }

    if (!validateBatchForm(createForm) || !userId) {
      return
    }

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
      setMessage('Tạo lô hàng thành công.')
      await loadData()
    } catch {
      setMessage('Tạo lô hàng thất bại.')
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
      setMessage('Upload file QC thất bại.')
    } finally {
      setUploadingQcFile(false)
    }
  }

  const uploadVideoDocument = async (file: File, forCreate: boolean) => {
    setUploadingVideo(true)
    try {
      const uploaded = await uploadBatchVideo(file)
      if (forCreate) {
        setCreateForm((prev) => ({ ...prev, videoUrl: uploaded.url }))
      } else {
        setEditForm((prev) => ({ ...prev, videoUrl: uploaded.url }))
      }
    } catch {
      setMessage('Upload video thất bại.')
    } finally {
      setUploadingVideo(false)
    }
  }

  return (
    <>
      <SupplierShell
        activeKey="products"
        title="Danh sách lô hàng"
        subtitle={product ? `${product.name} • ${product.unit}` : 'Danh sách lô hàng theo sản phẩm'}
        actions={
          <div className="flex justify-end gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              onClick={() => navigate('/supplier/products')}
            >
              <ArrowLeft className="h-4 w-4" />
              Quay về sản phẩm
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={() => {
                setCreateForm(EMPTY_BATCH_FORM)
                setOpenCreateModal(true)
              }}
            >
              Tạo lô hàng mới
            </button>
          </div>
        }
      >
        <div className="mb-4 grid gap-2 rounded-xl border border-emerald-200 bg-white p-3 md:grid-cols-3">
          <label className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="Tìm theo mã lô / tên sản phẩm"
              className="h-9 w-full rounded-md border border-slate-300 pl-8 pr-2 text-xs"
            />
          </label>

          <label className="relative">
            <CalendarDays className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <select
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value as 'all' | '7d' | '30d' | '90d')}
              className="h-9 w-full rounded-md border border-slate-300 pl-8 pr-2 text-xs"
            >
              <option value="all">Tất cả thời gian</option>
              <option value="7d">7 ngày gần đây</option>
              <option value="30d">30 ngày gần đây</option>
              <option value="90d">90 ngày gần đây</option>
            </select>
          </label>

          <div className="flex items-center text-xs text-slate-500">Tổng số lô: {filteredBatches.length}</div>
        </div>

        {message ? <p className="mb-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {loading ? <p className="text-sm font-semibold text-emerald-700">Đang tải dữ liệu...</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBatches.map((batch) => {
            const lotStatus = deriveLotStatus(Number(batch.quantity || 0))
            return (
              <article key={batch.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="relative h-36 bg-slate-50">
                  <span className={`absolute right-3 top-3 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass(lotStatus)}`}>
                    {statusLabel(lotStatus)}
                  </span>
                  <img
                    src={batch.imageUrl || product?.imageUrls[0] || 'https://placehold.co/320x200?text=No+Image'}
                    alt={batch.batchCode || `batch-${batch.id}`}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="space-y-2 p-3 text-xs">
                  <h3 className="text-base font-bold text-emerald-950">{batch.batchCode || `Lô #${batch.id}`}</h3>
                  <p className="text-emerald-700">{batch.productName}</p>

                  <div className="grid grid-cols-2 gap-y-1">
                    <Meta label="Grade" value={batch.grade || 'N/A'} />
                    <Meta label="Size" value={batch.size || 'N/A'} />
                    <Meta label="Tồn kho" value={`${batch.quantity}${product?.unit || ''}`} />
                    <Meta label="MOQ" value={`${batch.moq}${product?.unit || ''}`} />
                  </div>

                  <div className="border-t border-slate-200 pt-2">
                    <p className="text-2xl font-black text-emerald-700">
                      {batch.price.toLocaleString('vi-VN')}đ
                      <span className="ml-1 text-xs font-medium text-slate-600">/{product?.unit || 'kg'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 font-semibold text-slate-700"
                      onClick={() => void openDetail(batch.id)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Chi tiết
                    </button>
                    <button
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 font-semibold text-emerald-700"
                      onClick={() => void openEdit(batch.id)}
                    >
                      Sửa
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-md border border-rose-300 px-2 py-1.5 font-semibold text-rose-600"
                      onClick={() => void handleDelete(batch.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </SupplierShell>

      {detail ? (
        <div className="fixed inset-0 z-[80] bg-black/35 p-4">
          <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white p-4 text-sm">
            <h3 className="text-lg font-bold text-slate-900">Chi tiết lô hàng</h3>
            <p className="mt-1 text-xs text-slate-500">{detail.batchCode || `Lô #${detail.id}`}</p>

            <div className="mt-3 grid gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-2">
              <InfoRow label="Grade" value={detail.grade || 'N/A'} />
              <InfoRow label="Size" value={detail.size || 'N/A'} />
              <InfoRow label="Số lượng" value={String(detail.quantity)} />
              <InfoRow label="Giá" value={`${detail.price.toLocaleString('vi-VN')} đ`} />
              <InfoRow label="MOQ" value={String(detail.moq)} />
              <InfoRow label="Nhiệt độ" value={detail.storageTemp || 'N/A'} />
              <InfoRow label="Ngày thu hoạch" value={detail.harvestDate} />
              <InfoRow label="Ngày hết hạn" value={detail.expiryDate || 'N/A'} />
            </div>

            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
              <p className="font-semibold text-emerald-900">QC</p>
              <p>Kết quả: {detail.qcResult || 'N/A'}</p>
              <p>Ghi chú: {detail.qcNotes || 'N/A'}</p>
              {detail.qcDocumentUrl ? (
                <a href={detail.qcDocumentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-emerald-700">
                  <ExternalLink className="h-3 w-3" /> File QC
                </a>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {detail.imageUrls.map((url) => (
                <img key={url} src={url} alt="batch-image" className="h-16 w-16 rounded border border-slate-200 object-cover" />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-1.5 text-xs" onClick={() => setDetail(null)}>
                Đóng
              </button>
              {detail.qrCode ? (
                <a
                  href={detail.qrCode}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <ExternalLink className="h-3 w-3" /> Mở truy xuất
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {openCreateModal ? (
        <BatchModal
          title="Tạo lô hàng mới"
          form={createForm}
          setForm={setCreateForm}
          unit={product?.unit || 'kg'}
          submitting={submitting}
          uploadingQcFile={uploadingQcFile}
          uploadingVideo={uploadingVideo}
          onClose={() => setOpenCreateModal(false)}
          onSubmit={() => void submitCreateBatch()}
          onUploadQc={(file) => void uploadQcDocument(file, true)}
          onUploadVideo={(file) => void uploadVideoDocument(file, true)}
        />
      ) : null}

      {editingBatchId ? (
        <BatchModal
          title="Sửa lô hàng"
          form={editForm}
          setForm={setEditForm}
          unit={product?.unit || 'kg'}
          submitting={submitting}
          uploadingQcFile={uploadingQcFile}
          uploadingVideo={uploadingVideo}
          onClose={() => {
            setEditingBatchId(null)
            setEditForm(EMPTY_BATCH_FORM)
          }}
          onSubmit={() => void submitEditBatch()}
          onUploadQc={(file) => void uploadQcDocument(file, false)}
          onUploadVideo={(file) => void uploadVideoDocument(file, false)}
        />
      ) : null}
    </>
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
  onClose,
  onSubmit,
  onUploadQc,
  onUploadVideo,
}: {
  title: string
  form: BatchForm
  setForm: React.Dispatch<React.SetStateAction<BatchForm>>
  unit: string
  submitting: boolean
  uploadingQcFile: boolean
  uploadingVideo: boolean
  onClose: () => void
  onSubmit: () => void
  onUploadQc: (file: File) => void
  onUploadVideo: (file: File) => void
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/35 p-4">
      <div className="mx-auto mt-4 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>

        <div className="space-y-2 p-4 text-xs">
          <div className="grid gap-2 md:grid-cols-2">
            <Field
              label="Ngày thu hoạch/đánh bắt"
              type="date"
              value={form.harvestDate}
              onChange={(value) => setForm((prev) => ({ ...prev, harvestDate: value }))}
              required
            />
            <Field
              label="Ngày hết hạn"
              type="date"
              value={form.expiryDate}
              onChange={(value) => setForm((prev) => ({ ...prev, expiryDate: value }))}
            />
            <FieldSelect
              label="Grade"
              value={form.grade}
              onChange={(value) => setForm((prev) => ({ ...prev, grade: value as 'A' | 'B' | 'C' | '' }))}
              options={[
                { label: 'A', value: 'A' },
                { label: 'B', value: 'B' },
                { label: 'C', value: 'C' },
              ]}
              required
            />
            <Field label="Size" value={form.size} onChange={(value) => setForm((prev) => ({ ...prev, size: value }))} />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <Field
              label={`Tồn kho (${unit})`}
              type="number"
              value={form.quantity}
              onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))}
              required
            />
            <Field
              label="Giá"
              type="number"
              value={form.price}
              onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
              required
            />
            <Field
              label={`MOQ (${unit})`}
              type="number"
              value={form.moq}
              onChange={(value) => setForm((prev) => ({ ...prev, moq: value }))}
            />
          </div>

          <Field
            label="Nhiệt độ bảo quản (°C)"
            type="number"
            value={form.storageTempValue}
            onChange={(value) => setForm((prev) => ({ ...prev, storageTempValue: value }))}
          />

          <div className="rounded-md border border-emerald-200 p-2">
            <p className="mb-2 text-[11px] font-semibold text-emerald-900">Video & QC</p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px]">
                {uploadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />} Upload video
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      onUploadVideo(file)
                    }
                    event.currentTarget.value = ''
                  }}
                />
              </label>
              {form.videoUrl ? (
                <a href={form.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700">
                  <ExternalLink className="h-3 w-3" /> Link video
                </a>
              ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-slate-700">Kết quả QC</p>
                <div className="flex items-center gap-2">
                  <button
                    className={`rounded border px-2 py-1 ${form.qcResult === 'PASS' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300'}`}
                    onClick={() => setForm((prev) => ({ ...prev, qcResult: 'PASS' }))}
                  >
                    PASS
                  </button>
                  <button
                    className={`rounded border px-2 py-1 ${form.qcResult === 'FAIL' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-300'}`}
                    onClick={() => setForm((prev) => ({ ...prev, qcResult: 'FAIL' }))}
                  >
                    FAIL
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold text-slate-700">File kiểm định</p>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px]">
                  {uploadingQcFile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        onUploadQc(file)
                      }
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
                {form.qcDocumentUrl ? <p className="truncate text-[10px] text-emerald-700">{form.qcDocumentUrl}</p> : null}
              </div>
            </div>

            <FieldTextArea
              label="Ghi chú kiểm định"
              value={form.qcNotes}
              onChange={(value) => setForm((prev) => ({ ...prev, qcNotes: value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
          <button className="rounded border border-slate-300 px-3 py-1.5" onClick={onClose}>
            Hủy
          </button>
          <button
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs text-slate-700">
      <span className="font-semibold text-slate-900">{label}: </span>
      {value}
    </p>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-[11px] text-slate-500">{label}</span>
      <span className="text-[13px] font-semibold text-slate-900">{value}</span>
    </p>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date'
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
      />
    </label>
  )
}

function FieldTextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-16 w-full rounded border border-slate-300 px-2 py-1 text-[12px]"
      />
    </label>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
      >
        <option value="">-- Chọn --</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
