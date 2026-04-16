import {
  ChevronDown,
  ChevronLeft,
  Eye,
  ExternalLink,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import {
  createBatchForExistingProduct,
  createProductOnly,
  createProductWithFirstBatch,
  deleteSupplierProduct,
  fetchCategories,
  fetchCertificationNames,
  fetchMetadataProvinces,
  fetchMetadataUnits,
  fetchSupplierProducts,
  getProductBatches,
  getSupplierProductDetail,
  updateSupplierProduct,
} from '../../services/supplierService'
import { uploadBatchVideo, uploadSupplierDocument } from '../../services/uploadService'
import type {
  CategoryOption,
  CreateBatchForProductRequest,
  CreateBatchPayload,
  CreateProductOnlyRequest,
  CreateProductWithFirstBatchRequest,
  SupplierBatchCard,
  SupplierCreateFlowResponse,
  SupplierProductDetail,
  SupplierProductOption,
  UpdateProductRequest,
} from '../../types/supplierCreateFlow'

const modalBackdropClass = 'fixed inset-0 z-[80] bg-black/35 p-4'

type CertificationDraft = {
  optionName: string
  customName: string
  issuedBy: string
  issuedDate: string
  expiryDate: string
  documentUrl: string
  documentName: string
}

type CertificationItem = {
  id: string
  name: string
  issuedBy: string
  issuedDate: string
  expiryDate: string
  documentUrl: string
}

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

type StockStatus = 'con-hang' | 'sap-het' | 'het-hang'

type ProductCardItem = {
  product: SupplierProductOption
  batches: SupplierBatchCard[]
  totalQuantity: number
  latestBatch: SupplierBatchCard | null
  stockStatus: StockStatus
}

const EMPTY_CERT_DRAFT: CertificationDraft = {
  optionName: '',
  customName: '',
  issuedBy: '',
  issuedDate: '',
  expiryDate: '',
  documentUrl: '',
  documentName: '',
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

const LOW_STOCK_THRESHOLD = 100

function deriveStockStatus(totalQuantity: number): StockStatus {
  if (totalQuantity <= 0) {
    return 'het-hang'
  }
  if (totalQuantity <= LOW_STOCK_THRESHOLD) {
    return 'sap-het'
  }
  return 'con-hang'
}

function stockStatusLabel(status: StockStatus): string {
  if (status === 'con-hang') {
    return 'Còn hàng'
  }
  if (status === 'sap-het') {
    return 'Sắp hết'
  }
  return 'Hết hàng'
}

function stockStatusClass(status: StockStatus): string {
  if (status === 'con-hang') {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (status === 'sap-het') {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-rose-100 text-rose-700'
}

export function SupplierProductListPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const [products, setProducts] = useState<ProductCardItem[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [provinces, setProvinces] = useState<string[]>([])
  const [certificationNames, setCertificationNames] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | StockStatus>('')
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest')

  const [openProductModal, setOpenProductModal] = useState(false)
  const [openBatchModal, setOpenBatchModal] = useState(false)
  const [openProductDetailModal, setOpenProductDetailModal] = useState(false)
  const [productModalStep, setProductModalStep] = useState<1 | 2>(1)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)

  const [menuProductId, setMenuProductId] = useState<number | null>(null)

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [selectedProductDetail, setSelectedProductDetail] = useState<SupplierProductDetail | null>(null)

  const [productName, setProductName] = useState('')
  const [productCategoryId, setProductCategoryId] = useState('')
  const [productUnit, setProductUnit] = useState('')
  const [productProvince, setProductProvince] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productImageUrls, setProductImageUrls] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  const [certDraft, setCertDraft] = useState<CertificationDraft>(EMPTY_CERT_DRAFT)
  const [certItems, setCertItems] = useState<CertificationItem[]>([])

  const [batchForm, setBatchForm] = useState<BatchForm>(EMPTY_BATCH_FORM)
  const [uploadingQcFile, setUploadingQcFile] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)

  const companyId = Number(sessionStorage.getItem('agribridge.auth.companyId') ?? 0)
  const userId = Number(sessionStorage.getItem('agribridge.auth.userId') ?? 0)

  const loadInitial = async () => {
    if (!companyId) {
      setMessage('Thiếu companyId trong session, vui lòng đăng nhập lại.')
      return
    }

    setLoading(true)
    try {
      const [productList, categoryList, unitList, provinceList, certNameList] = await Promise.all([
        fetchSupplierProducts(companyId),
        fetchCategories(),
        fetchMetadataUnits(),
        fetchMetadataProvinces(),
        fetchCertificationNames(),
      ])

      const productCards = await Promise.all(
        productList.map(async (product) => {
          let batches: Awaited<ReturnType<typeof getProductBatches>> = []
          try {
            batches = await getProductBatches(product.id)
          } catch {
            batches = []
          }
          const sortedById = [...batches].sort((a, b) => b.id - a.id)
          const latestBatch = sortedById[0] ?? null
          const totalQuantity = batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0)
          return {
            product,
            batches,
            totalQuantity,
            latestBatch,
            stockStatus: deriveStockStatus(totalQuantity),
          }
        }),
      )

      setProducts(productCards)
      setCategories(categoryList)
      setUnits(unitList)
      setProvinces(provinceList)
      setCertificationNames(certNameList)
    } catch {
      setMessage('Không thể tải dữ liệu sản phẩm.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInitial()
  }, [companyId])

  const selectedProductCard =
    selectedProductId == null ? null : products.find((item) => item.product.id === selectedProductId) ?? null

  const filteredProducts = useMemo(() => {
    let next = [...products]

    if (search.trim()) {
      const keyword = search.trim().toLowerCase()
      next = next.filter((item) => item.product.name.toLowerCase().includes(keyword))
    }

    if (categoryFilter) {
      next = next.filter((item) => String(item.product.categoryId) === categoryFilter)
    }

    if (provinceFilter) {
      next = next.filter((item) => item.product.originProvince === provinceFilter)
    }

    if (statusFilter) {
      next = next.filter((item) => item.stockStatus === statusFilter)
    }

    if (sortBy === 'newest') {
      next.sort((a, b) => b.product.id - a.product.id)
    }

    if (sortBy === 'price-asc') {
      next.sort((a, b) => (a.latestBatch?.price ?? Number.MAX_SAFE_INTEGER) - (b.latestBatch?.price ?? Number.MAX_SAFE_INTEGER))
    }

    if (sortBy === 'price-desc') {
      next.sort((a, b) => (b.latestBatch?.price ?? 0) - (a.latestBatch?.price ?? 0))
    }

    return next
  }, [products, search, categoryFilter, provinceFilter, statusFilter, sortBy])

  const resetProductForm = () => {
    setProductModalStep(1)
    setProductName('')
    setProductCategoryId('')
    setProductUnit('')
    setProductProvince('')
    setProductDescription('')
    setProductImageUrls([])
    setCertDraft(EMPTY_CERT_DRAFT)
    setCertItems([])
    setBatchForm(EMPTY_BATCH_FORM)
    setEditingProductId(null)
  }

  const openCreateProductModal = () => {
    resetProductForm()
    setOpenProductModal(true)
  }

  const openCreateBatchModal = (productId?: number) => {
    setSelectedProductId(productId ?? null)
    setBatchForm(EMPTY_BATCH_FORM)
    setOpenBatchModal(true)
  }

  const openEditProductModal = async (productId: number) => {
    try {
      const detail = await getSupplierProductDetail(productId)
      resetProductForm()
      setEditingProductId(productId)
      setProductName(detail.name)
      setProductCategoryId(String(detail.categoryId))
      setProductUnit(detail.unit)
      setProductProvince(detail.originProvince)
      setProductDescription(detail.description ?? '')
      setProductImageUrls(detail.imageUrls ?? [])
      setCertItems(
        detail.certifications.map((item) => ({
          id: String(item.id),
          name: item.name,
          issuedBy: item.issuedBy ?? '',
          issuedDate: item.issuedDate ?? '',
          expiryDate: item.expiryDate ?? '',
          documentUrl: item.documentUrl ?? '',
        })),
      )
      setOpenProductModal(true)
    } catch {
      setMessage('Không thể tải dữ liệu để sửa sản phẩm.')
    }
  }

  const uploadDocument = async (file: File, onDone: (url: string) => void, setBusy?: (value: boolean) => void) => {
    setBusy?.(true)
    try {
      const uploaded = await uploadSupplierDocument(file)
      onDone(uploaded.url)
    } catch {
      setMessage('Upload tài liệu thất bại.')
    } finally {
      setBusy?.(false)
    }
  }

  const uploadVideo = async (file: File) => {
    setUploadingVideo(true)
    try {
      const uploaded = await uploadBatchVideo(file)
      setBatchForm((prev) => ({ ...prev, videoUrl: uploaded.url }))
    } catch {
      setMessage('Upload video thất bại.')
    } finally {
      setUploadingVideo(false)
    }
  }

  const addCertificationBox = () => {
    const certName = certDraft.optionName === '__custom__' ? certDraft.customName.trim() : certDraft.optionName.trim()

    if (!certName) {
      setMessage('Vui lòng chọn hoặc nhập tên chứng nhận.')
      return
    }

    if (!certDraft.issuedDate || !certDraft.expiryDate) {
      setMessage('Ngày cấp và ngày hết hạn của chứng nhận là bắt buộc.')
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    if (certDraft.issuedDate > today) {
      setMessage('Ngày cấp không được ở tương lai.')
      return
    }

    if (certDraft.expiryDate < today) {
      setMessage('Ngày hết hạn không được ở quá khứ.')
      return
    }

    if (certDraft.expiryDate <= certDraft.issuedDate) {
      setMessage('Ngày hết hạn phải sau ngày cấp.')
      return
    }

    setCertItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: certName,
        issuedBy: certDraft.issuedBy.trim(),
        issuedDate: certDraft.issuedDate,
        expiryDate: certDraft.expiryDate,
        documentUrl: certDraft.documentUrl,
      },
    ])

    setCertDraft(EMPTY_CERT_DRAFT)
  }

  const validateProductInput = (): boolean => {
    if (!productName.trim()) {
      setMessage('Tên sản phẩm là bắt buộc.')
      return false
    }
    if (!productCategoryId) {
      setMessage('Danh mục là bắt buộc.')
      return false
    }
    if (!productUnit) {
      setMessage('Đơn vị là bắt buộc.')
      return false
    }
    if (!productProvince) {
      setMessage('Tỉnh xuất xứ là bắt buộc.')
      return false
    }
    return true
  }

  const validateBatchInput = (): boolean => {
    if (!batchForm.harvestDate) {
      setMessage('Ngày thu hoạch/đánh bắt là bắt buộc.')
      return false
    }

    const today = new Date().toISOString().slice(0, 10)
    if (batchForm.harvestDate > today) {
      setMessage('Ngày thu hoạch/đánh bắt không được ở tương lai.')
      return false
    }

    if (batchForm.expiryDate && batchForm.expiryDate < today) {
      setMessage('Ngày hết hạn không được ở quá khứ.')
      return false
    }

    if (batchForm.expiryDate && batchForm.expiryDate <= batchForm.harvestDate) {
      setMessage('Ngày hết hạn phải sau ngày thu hoạch.')
      return false
    }

    if (!batchForm.grade) {
      setMessage('Grade là bắt buộc.')
      return false
    }

    if (!batchForm.quantity || Number(batchForm.quantity) <= 0) {
      setMessage('Tồn kho phải lớn hơn 0.')
      return false
    }

    if (!batchForm.price || Number(batchForm.price) <= 0) {
      setMessage('Giá phải lớn hơn 0.')
      return false
    }

    if (!batchForm.qcResult) {
      setMessage('Kết quả QC là bắt buộc.')
      return false
    }

    if (batchForm.qcResult === 'PASS' && !batchForm.qcDocumentUrl.trim()) {
      setMessage('PASS bắt buộc có file kiểm định.')
      return false
    }

    if (batchForm.qcResult === 'FAIL' && !batchForm.qcNotes.trim()) {
      setMessage('FAIL bắt buộc có ghi chú kiểm định.')
      return false
    }

    return true
  }

  const toBatchPayload = (): CreateBatchPayload => {
    const storageTemp = batchForm.storageTempValue.trim() ? `${batchForm.storageTempValue.trim()}°C` : undefined

    return {
      harvestDate: batchForm.harvestDate,
      expiryDate: batchForm.expiryDate || undefined,
      grade: batchForm.grade as 'A' | 'B' | 'C',
      size: batchForm.size.trim() || undefined,
      quantity: Number(batchForm.quantity),
      price: Number(batchForm.price),
      moq: batchForm.moq ? Number(batchForm.moq) : 0,
      storageTemp,
      videoUrl: batchForm.videoUrl.trim() || undefined,
      qc: {
        result: batchForm.qcResult as 'PASS' | 'FAIL',
        documentUrl: batchForm.qcDocumentUrl.trim() || undefined,
        notes: batchForm.qcNotes.trim() || undefined,
      },
    }
  }

  const toProductUpdatePayload = (): UpdateProductRequest => ({
    product: {
      name: productName.trim(),
      categoryId: Number(productCategoryId),
      unit: productUnit,
      originProvince: productProvince,
      description: productDescription.trim() || undefined,
      imageUrls: productImageUrls,
      certifications: certItems.map((item) => ({
        name: item.name,
        documentUrl: item.documentUrl || undefined,
        issuedBy: item.issuedBy || undefined,
        issuedDate: item.issuedDate || undefined,
        expiryDate: item.expiryDate || undefined,
      })),
    },
  })

  const submitProductOnly = async () => {
    if (!validateProductInput() || !companyId) {
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      if (editingProductId) {
        await updateSupplierProduct(editingProductId, toProductUpdatePayload())
        setMessage('Cập nhật sản phẩm thành công.')
      } else {
        const payload: CreateProductOnlyRequest = {
          supplierCompanyId: companyId,
          product: {
            name: productName.trim(),
            categoryId: Number(productCategoryId),
            unit: productUnit,
            originProvince: productProvince,
            description: productDescription.trim() || undefined,
            imageUrls: productImageUrls,
            certifications: certItems.map((item) => ({
              name: item.name,
              documentUrl: item.documentUrl || undefined,
              issuedBy: item.issuedBy || undefined,
              issuedDate: item.issuedDate || undefined,
              expiryDate: item.expiryDate || undefined,
            })),
          },
        }
        await createProductOnly(payload)
        setMessage('Tạo sản phẩm thành công.')
      }

      setOpenProductModal(false)
      resetProductForm()
      await loadInitial()
    } catch {
      setMessage(editingProductId ? 'Cập nhật sản phẩm thất bại.' : 'Tạo sản phẩm thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitProductWithFirstBatch = async () => {
    if (editingProductId) {
      setMessage('Chế độ sửa sản phẩm không áp dụng tạo lô hàng đầu tiên.')
      return
    }

    if (!validateProductInput() || !validateBatchInput() || !companyId || !userId) {
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const payload: CreateProductWithFirstBatchRequest = {
        supplierCompanyId: companyId,
        userId,
        product: {
          name: productName.trim(),
          categoryId: Number(productCategoryId),
          unit: productUnit,
          originProvince: productProvince,
          description: productDescription.trim() || undefined,
          imageUrls: productImageUrls,
          certifications: certItems.map((item) => ({
            name: item.name,
            documentUrl: item.documentUrl || undefined,
            issuedBy: item.issuedBy || undefined,
            issuedDate: item.issuedDate || undefined,
            expiryDate: item.expiryDate || undefined,
          })),
        },
        batch: toBatchPayload(),
      }

      const response: SupplierCreateFlowResponse = await createProductWithFirstBatch(payload)
      setOpenProductModal(false)
      resetProductForm()
      setMessage('Tạo sản phẩm và lô hàng thành công.')
      await loadInitial()
      navigate(`/supplier/products/${response.product.id}/lots`)
    } catch {
      setMessage('Tạo sản phẩm và lô hàng thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCreateBatch = async () => {
    if (!selectedProductId) {
      setMessage('Vui lòng chọn sản phẩm để tạo lô hàng.')
      return
    }

    if (!validateBatchInput() || !userId) {
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const payload: CreateBatchForProductRequest = {
        productId: selectedProductId,
        userId,
        batch: toBatchPayload(),
      }

      await createBatchForExistingProduct(payload)
      setOpenBatchModal(false)
      setBatchForm(EMPTY_BATCH_FORM)
      await loadInitial()
      navigate(`/supplier/products/${selectedProductId}/lots`)
    } catch {
      setMessage('Tạo lô hàng thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const openProductDetail = async (productId: number) => {
    try {
      const detail = await getSupplierProductDetail(productId)
      setSelectedProductDetail(detail)
      setOpenProductDetailModal(true)
    } catch {
      setMessage('Không thể tải chi tiết sản phẩm.')
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    const confirmed = window.confirm('Xóa sản phẩm này và toàn bộ lô hàng liên quan?')
    if (!confirmed) {
      return
    }

    try {
      await deleteSupplierProduct(productId)
      setMenuProductId(null)
      await loadInitial()
    } catch {
      setMessage('Không thể xóa sản phẩm.')
    }
  }

  return (
    <>
      <SupplierShell
        activeKey="products"
        title="Sản phẩm & Lô hàng"
        subtitle="Quản lý sản phẩm và lô hàng của bạn"
        actions={
          <div className="flex justify-end gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-emerald-500 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700"
              onClick={() => openCreateBatchModal()}
            >
              <Plus className="h-4 w-4" />
              Tạo lô hàng mới
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={openCreateProductModal}
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm mới
            </button>
          </div>
        }
      >
        <p className="mb-2 text-xs font-semibold text-emerald-700">Tong so san pham: {filteredProducts.length}</p>

        <div className="mb-4 grid gap-2 rounded-xl border border-emerald-200 bg-white p-3 md:grid-cols-6">
          <label className="relative md:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên sản phẩm"
              className="h-9 w-full rounded-md border border-slate-300 pl-8 pr-2 text-xs"
            />
          </label>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-xs"
          >
            <option value="">Danh mục</option>
            {categories.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={provinceFilter}
            onChange={(event) => setProvinceFilter(event.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-xs"
          >
            <option value="">Tỉnh xuất xứ</option>
            {provinces.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | StockStatus)}
            className="h-9 rounded-md border border-slate-300 px-2 text-xs"
          >
            <option value="">Trạng thái</option>
            <option value="con-hang">Còn hàng</option>
            <option value="sap-het">Sắp hết</option>
            <option value="het-hang">Hết hàng</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as 'newest' | 'price-asc' | 'price-desc')}
            className="h-9 rounded-md border border-slate-300 px-2 text-xs"
          >
            <option value="newest">Mới nhất</option>
            <option value="price-asc">Giá tăng dần</option>
            <option value="price-desc">Giá giảm dần</option>
          </select>

        </div>

        {message ? <p className="mb-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {loading ? <p className="text-sm font-semibold text-emerald-700">Đang tải dữ liệu...</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filteredProducts.map((item) => (
            <article
              key={item.product.id}
              className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              onClick={() => navigate(`/supplier/products/${item.product.id}/lots`)}
            >
              <div className="relative h-28 bg-slate-50">
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700">
                  {item.batches.length} lo
                </span>
                <span className={`absolute right-3 top-3 rounded-full px-2 py-1 text-[10px] font-semibold ${stockStatusClass(item.stockStatus)}`}>
                  {stockStatusLabel(item.stockStatus)}
                </span>
                <img
                  src={item.product.imageUrl || 'https://placehold.co/420x220?text=No+Image'}
                  alt={item.product.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-2 p-3">
                <h3 className="truncate text-[18px] font-bold text-emerald-950">{item.product.name}</h3>
                <p className="text-xs text-emerald-700">
                  ♻ Lô liền tại: {item.latestBatch?.batchCode || 'Chưa có lô'}
                </p>

                <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-700">
                  <Info label="Grade" value={item.latestBatch?.grade || 'N/A'} />
                  <Info label="Size" value={item.latestBatch?.size || 'N/A'} />
                  <Info label="Tồn kho" value={`${item.totalQuantity}${item.product.unit}`} />
                  <Info label="MOQ" value={`${item.latestBatch?.moq ?? 0}${item.product.unit}`} />
                </div>

                <div className="border-t border-slate-200 pt-2">
                  <p className="text-[28px] font-black text-emerald-700">
                    {(item.latestBatch?.price ?? 0).toLocaleString('vi-VN')}đ
                    <span className="ml-1 text-xs font-medium text-slate-600">/{item.product.unit}</span>
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_52px_32px] gap-1.5">
                  <button
                    className="rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white"
                    onClick={(event) => {
                      event.stopPropagation()
                      openCreateBatchModal(item.product.id)
                    }}
                  >
                    ✺ Thêm lô hàng
                  </button>
                  <button
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700"
                    onClick={(event) => {
                      event.stopPropagation()
                      void openEditProductModal(item.product.id)
                    }}
                  >
                    Sửa
                  </button>

                  <div className="relative">
                    <button
                      className="flex h-full w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600"
                      onClick={(event) => {
                        event.stopPropagation()
                        setMenuProductId((prev) => (prev === item.product.id ? null : item.product.id))
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuProductId === item.product.id ? (
                      <div className="absolute right-0 top-10 z-20 min-w-[132px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          className="inline-flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                          onClick={() => {
                            setMenuProductId(null)
                            void openProductDetail(item.product.id)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Xem chi tiết
                        </button>
                        <button
                          className="inline-flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                          onClick={() => {
                            setMenuProductId(null)
                            navigate(`/supplier/products/${item.product.id}/lots`)
                          }}
                        >
                          Xem các lô
                        </button>
                        <button
                          className="inline-flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => void handleDeleteProduct(item.product.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa sản phẩm
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SupplierShell>

      {openProductModal ? (
        <div className={modalBackdropClass}>
          <div className="mx-auto mt-3 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProductId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
              </h3>
              <button className="text-xs font-semibold text-slate-500" onClick={() => setOpenProductModal(false)}>
                Đóng
              </button>
            </div>

            <div className="space-y-3 p-4 text-sm">
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  className={`rounded-md px-3 py-1 ${productModalStep === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                  onClick={() => setProductModalStep(1)}
                >
                  1. Sản phẩm
                </button>
                <button
                  className={`rounded-md px-3 py-1 ${productModalStep === 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                  onClick={() => setProductModalStep(2)}
                  disabled={Boolean(editingProductId)}
                >
                  2. Lô hàng đầu tiên
                </button>
              </div>

              {productModalStep === 1 ? (
                <div className="space-y-3">
                  <Field label="Tên sản phẩm" value={productName} onChange={setProductName} required />
                  <div className="grid gap-2 md:grid-cols-2">
                    <FieldSelect
                      label="Danh mục"
                      value={productCategoryId}
                      onChange={setProductCategoryId}
                      required
                      options={categories.map((item) => ({ label: item.name, value: String(item.id) }))}
                    />
                    <FieldSelect
                      label="Đơn vị"
                      value={productUnit}
                      onChange={setProductUnit}
                      required
                      options={units.map((item) => ({ label: item, value: item }))}
                    />
                  </div>
                  <FieldSelect
                    label="Tỉnh xuất xứ"
                    value={productProvince}
                    onChange={setProductProvince}
                    required
                    options={provinces.map((item) => ({ label: item, value: item }))}
                  />
                  <FieldTextArea label="Mô tả" value={productDescription} onChange={setProductDescription} />

                  <section>
                    <p className="mb-1 text-xs font-semibold text-slate-700">Hình ảnh sản phẩm</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {productImageUrls.map((url) => (
                        <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-slate-200">
                          <img src={url} alt="preview" className="h-full w-full object-cover" />
                          <button
                            className="absolute right-1 top-1 rounded bg-white/80 px-1 text-[10px]"
                            onClick={() => setProductImageUrls((prev) => prev.filter((item) => item !== url))}
                          >
                            x
                          </button>
                        </div>
                      ))}
                      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500">
                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <span>Tải lên</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              void uploadDocument(
                                file,
                                (url) => setProductImageUrls((prev) => [...prev, url]),
                                setUploadingImage,
                              )
                            }
                            event.currentTarget.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-lg border border-emerald-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-emerald-900">Chứng nhận / Tiêu chuẩn</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <FieldSelect
                        label="Loại chứng nhận"
                        value={certDraft.optionName}
                        onChange={(value) => setCertDraft((prev) => ({ ...prev, optionName: value }))}
                        options={[
                          ...certificationNames.map((item) => ({ label: item, value: item })),
                          { label: 'Khác', value: '__custom__' },
                        ]}
                      />
                      <Field
                        label="Tổ chức cấp"
                        value={certDraft.issuedBy}
                        onChange={(value) => setCertDraft((prev) => ({ ...prev, issuedBy: value }))}
                      />
                    </div>

                    {certDraft.optionName === '__custom__' ? (
                      <Field
                        label="Tên custom"
                        value={certDraft.customName}
                        onChange={(value) => setCertDraft((prev) => ({ ...prev, customName: value }))}
                      />
                    ) : null}

                    <div className="grid gap-2 md:grid-cols-2">
                      <Field
                        label="Ngày cấp"
                        type="date"
                        value={certDraft.issuedDate}
                        onChange={(value) => setCertDraft((prev) => ({ ...prev, issuedDate: value }))}
                      />
                      <Field
                        label="Ngày hết hạn"
                        type="date"
                        value={certDraft.expiryDate}
                        onChange={(value) => setCertDraft((prev) => ({ ...prev, expiryDate: value }))}
                      />
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs">
                        <Upload className="h-3 w-3" />
                        File chứng nhận
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              void uploadDocument(file, (url) =>
                                setCertDraft((prev) => ({
                                  ...prev,
                                  documentUrl: url,
                                  documentName: file.name,
                                })),
                              )
                            }
                            event.currentTarget.value = ''
                          }}
                        />
                      </label>
                      <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" onClick={addCertificationBox}>
                        Thêm
                      </button>
                    </div>

                    {certDraft.documentUrl ? (
                      <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        Đã tải lên: {certDraft.documentName || certDraft.documentUrl}
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {certItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                          <div className="min-w-0">
                            <p className="font-semibold">{item.name}</p>
                            <p className="truncate text-[11px] text-emerald-700">
                              Cấp bởi {item.issuedBy || 'N/A'} · Ngày cấp: {item.issuedDate || 'N/A'} · Hết hạn: {item.expiryDate || 'N/A'}
                            </p>
                            {item.documentUrl ? (
                              <a className="truncate text-[11px] text-emerald-700 underline" href={item.documentUrl} target="_blank" rel="noreferrer">
                                {item.documentUrl}
                              </a>
                            ) : null}
                          </div>
                          <button
                            className="ml-2 rounded px-1 text-rose-600 hover:bg-rose-50"
                            onClick={() => setCertItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <BatchFormCompact
                  form={batchForm}
                  setForm={setBatchForm}
                  unit={productUnit || 'kg'}
                  uploadingQcFile={uploadingQcFile}
                  uploadingVideo={uploadingVideo}
                  onUploadQc={(file) =>
                    void uploadDocument(
                      file,
                      (url) => setBatchForm((prev) => ({ ...prev, qcDocumentUrl: url })),
                      setUploadingQcFile,
                    )
                  }
                  onUploadVideo={(file) => void uploadVideo(file)}
                />
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <button className="rounded border border-slate-300 px-3 py-1.5" onClick={() => setOpenProductModal(false)}>
                Hủy
              </button>
              <div className="flex items-center gap-2">
                {productModalStep === 2 && !editingProductId ? (
                  <button
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5"
                    onClick={() => setProductModalStep(1)}
                  >
                    <ChevronLeft className="h-3 w-3" /> Quay lại
                  </button>
                ) : null}

                {productModalStep === 1 && !editingProductId ? (
                  <button
                    className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 font-semibold text-white"
                    onClick={() => setProductModalStep(2)}
                  >
                    Tiếp theo <ChevronDown className="h-3 w-3" />
                  </button>
                ) : null}

                <button
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                  disabled={submitting}
                  onClick={() => void submitProductOnly()}
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {editingProductId ? 'Lưu cập nhật' : 'Thêm sản phẩm'}
                </button>

                {!editingProductId ? (
                  <button
                    className="inline-flex items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => void submitProductWithFirstBatch()}
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Tạo sản phẩm & lô
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {openBatchModal ? (
        <div className={modalBackdropClass}>
          <div className="mx-auto mt-6 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-lg font-bold text-slate-900">Tạo lô hàng mới</h3>
              <p className="text-xs text-slate-500">Chọn sản phẩm và nhập thông tin lô hàng</p>
            </div>
            <div className="space-y-3 p-4">
              <FieldSelect
                label="Sản phẩm"
                value={selectedProductId ? String(selectedProductId) : ''}
                onChange={(value) => setSelectedProductId(value ? Number(value) : null)}
                required
                options={products.map((item) => ({ label: item.product.name, value: String(item.product.id) }))}
              />
              <BatchFormCompact
                form={batchForm}
                setForm={setBatchForm}
                unit={selectedProductCard?.product.unit || 'kg'}
                uploadingQcFile={uploadingQcFile}
                uploadingVideo={uploadingVideo}
                onUploadQc={(file) =>
                  void uploadDocument(
                    file,
                    (url) => setBatchForm((prev) => ({ ...prev, qcDocumentUrl: url })),
                    setUploadingQcFile,
                  )
                }
                onUploadVideo={(file) => void uploadVideo(file)}
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <button className="rounded border border-slate-300 px-3 py-1.5" onClick={() => setOpenBatchModal(false)}>
                Hủy
              </button>
              <button
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                disabled={submitting}
                onClick={() => void submitCreateBatch()}
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Thêm lô hàng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openProductDetailModal && selectedProductDetail ? (
        <div className={modalBackdropClass}>
          <div className="mx-auto mt-10 max-w-xl rounded-xl bg-white p-4">
            <h3 className="text-lg font-bold text-slate-900">Chi tiết sản phẩm</h3>
            <p className="mt-2 text-sm">{selectedProductDetail.name}</p>
            <p className="text-xs text-slate-500">
              {selectedProductDetail.unit} • {selectedProductDetail.originProvince}
            </p>
            <p className="mt-2 text-sm text-slate-700">{selectedProductDetail.description || 'Không có mô tả.'}</p>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {selectedProductDetail.imageUrls.map((url) => (
                <img key={url} src={url} alt="product" className="h-16 w-full rounded border border-slate-200 object-cover" />
              ))}
            </div>

            <button
              className="mt-4 rounded border border-slate-300 px-3 py-1.5 text-xs"
              onClick={() => setOpenProductDetailModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-[11px] text-slate-500">{label}</span>
      <span className="text-[13px] font-semibold text-slate-900">{value}</span>
    </p>
  )
}

function BatchFormCompact({
  form,
  setForm,
  unit,
  uploadingQcFile,
  uploadingVideo,
  onUploadQc,
  onUploadVideo,
}: {
  form: BatchForm
  setForm: Dispatch<SetStateAction<BatchForm>>
  unit: string
  uploadingQcFile: boolean
  uploadingVideo: boolean
  onUploadQc: (file: File) => void
  onUploadVideo: (file: File) => void
}) {
  return (
    <div className="space-y-2 text-xs">
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
          required
          options={[
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
            { label: 'C', value: 'C' },
          ]}
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
        <Field label={`MOQ (${unit})`} type="number" value={form.moq} onChange={(value) => setForm((prev) => ({ ...prev, moq: value }))} />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Field
          label="Nhiệt độ bảo quản (°C)"
          type="number"
          value={form.storageTempValue}
          onChange={(value) => setForm((prev) => ({ ...prev, storageTempValue: value }))}
        />

        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-700">Video lô hàng</p>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px]">
              {uploadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />} Upload
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
                <ExternalLink className="h-3 w-3" /> Link
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-emerald-200 p-2">
        <p className="mb-2 text-[11px] font-semibold text-emerald-900">Kiểm định lô hàng (QC)</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-700">Kết quả</p>
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
              {uploadingQcFile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Upload
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
