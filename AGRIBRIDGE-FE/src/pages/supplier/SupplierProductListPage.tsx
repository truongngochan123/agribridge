import {
  Award,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Eye,
  Flame,
  Layers,
  Loader2,
  MapPin,
  Package2,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BatchFormFields, EMPTY_BATCH_FORM, type BatchFormState } from '../../components/supplier/BatchFormFields'
import { SupplierShell } from '../../components/supplier/SupplierShell'
import { useToast } from '../../hooks/useToast'
import { usePageTitle } from '../../hooks/usePageTitle'
import {
  createBatchForExistingProduct,
  createProductOnly,
  createSupplierCategory,
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
import { resolveUploadedFileUrl, uploadBatchVideo, uploadSupplierDocument } from '../../services/uploadService'
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
import { readApiErrorMessage } from '../../utils/readApiErrorMessage'
import { ProductsSkeletonLoader } from '../../components/supplier/SupplierSkeletons'

const modalBackdropClass =
  'fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4'

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

type BatchForm = BatchFormState

type StockStatus = 'con-hang' | 'sap-het' | 'het-hang'

type ProductCertificationPreview = {
  id: number
  name: string
  documentUrl?: string | null
  issuedBy?: string | null
  issuedDate?: string | null
  expiryDate?: string | null
}

type ProductCardItem = {
  product: SupplierProductOption
  batches: SupplierBatchCard[]
  totalQuantity: number
  latestBatch: SupplierBatchCard | null
  stockStatus: StockStatus
  certifications: ProductCertificationPreview[]
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

const LOW_STOCK_THRESHOLD = 100
const MAX_BATCH_VIDEO_SIZE_BYTES = 95 * 1024 * 1024

const CATEGORY_NAME_BY_ID: Record<number, string> = {
  1: 'Rau củ',
  2: 'Trái cây',
  3: 'Nấm',
  4: 'Ngũ cốc',
  5: 'Nông sản khô',
  6: 'Gia vị',
  7: 'Thực phẩm chế biến',
  8: 'Hải sản tươi sống',
  9: 'Hải sản đông lạnh',
  10: 'Hải sản khô',
  11: 'Thịt',
  12: 'Trứng',
  13: 'Sữa',
  14: 'Thức ăn chăn nuôi',
  15: 'Giống cây trồng',
  16: 'Vật tư nông nghiệp',
}

const CATEGORY_NAME_FALLBACKS: Record<string, string> = {
  'Rau c?': 'Rau củ',
  'N?m': 'Nấm',
  'Ngu c?c': 'Ngũ cốc',
  'Nông s?n khô': 'Nông sản khô',
  'Gia v?': 'Gia vị',
  'Th?c ph?m ch? bi?n': 'Thực phẩm chế biến',
  'H?i s?n tươi s?ng': 'Hải sản tươi sống',
  'H?i s?n đông l?nh': 'Hải sản đông lạnh',
  'H?i s?n khô': 'Hải sản khô',
  'Th?t': 'Thịt',
  'Tr?ng': 'Trứng',
  'S?a': 'Sữa',
  'Th?c an chan nuôi': 'Thức ăn chăn nuôi',
  'Gi?ng cây tr?ng': 'Giống cây trồng',
  'V?t tu nông nghi?p': 'Vật tư nông nghiệp',
}

function normalizeCategoryName(name: string, categoryId: number): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return trimmed
  }

  const byFallback = CATEGORY_NAME_FALLBACKS[trimmed]
  if (byFallback) {
    return byFallback
  }

  if (/[?]/.test(trimmed)) {
    return CATEGORY_NAME_BY_ID[categoryId] ?? trimmed
  }

  return trimmed
}

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

function stockStatusBadge(status: StockStatus): string {
  if (status === 'con-hang') {
    return 'bg-emerald-500/15 text-emerald-700 border border-emerald-300/50'
  }
  if (status === 'sap-het') {
    return 'bg-amber-500/15 text-amber-700 border border-amber-300/50'
  }
  return 'bg-rose-500/15 text-rose-700 border border-rose-300/50'
}

function compactCurrency(value: number): string {
  if (value >= 1000) {
    const compact = value / 1000
    if (Number.isInteger(compact)) {
      return `${compact}k`
    }
    return `${compact.toFixed(1).replace(/\.0$/, '')}k`
  }
  return value.toLocaleString('vi-VN')
}

function formatBatchPriceRange(batches: SupplierBatchCard[], unit: string): string {
  const prices = batches
    .map((batch) => Number(batch.price || 0))
    .filter((price) => Number.isFinite(price) && price > 0)

  if (prices.length === 0) {
    return `N/A/${unit}`
  }

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const minText = compactCurrency(min)
  const maxText = compactCurrency(max)

  if (min === max) {
    return `${minText} /${unit}`
  }

  return `${minText} – ${maxText} /${unit}`
}

function toAbsoluteUploadedUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  if (!trimmed) {
    return undefined
  }
  return resolveUploadedFileUrl(trimmed) || trimmed
}

export function SupplierProductListPage() {
  usePageTitle('Danh sách sản phẩm')
  const navigate = useNavigate()
  const { showToast, showConfirm } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [selectedProductDetail, setSelectedProductDetail] = useState<SupplierProductDetail | null>(null)
  const [certPreviewProduct, setCertPreviewProduct] = useState<{ name: string; certifications: ProductCertificationPreview[] } | null>(null)

  const [productName, setProductName] = useState('')
  const [productCategoryId, setProductCategoryId] = useState('')
  const [productUnit, setProductUnit] = useState('')
  const [productProvince, setProductProvince] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productImageUrls, setProductImageUrls] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryError, setNewCategoryError] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  const [certDraft, setCertDraft] = useState<CertificationDraft>(EMPTY_CERT_DRAFT)
  const [certItems, setCertItems] = useState<CertificationItem[]>([])

  const [batchForm, setBatchForm] = useState<BatchForm>(EMPTY_BATCH_FORM)
  const [uploadingQcFile, setUploadingQcFile] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingBatchImage, setUploadingBatchImage] = useState(false)

  const companyId = Number(localStorage.getItem('agribridge.auth.companyId') ?? 0)
  const userId = Number(localStorage.getItem('agribridge.auth.userId') ?? 0)

  const loadInitial = async () => {
    if (!companyId) {
      showToast('Thiếu companyId trong session, vui lòng đăng nhập lại.', 'error')
      return
    }

    setLoading(true)
    try {
      const [productList, categoryList, unitList, provinceList, certNameList] = await Promise.all([
        fetchSupplierProducts(companyId),
        fetchCategories(userId || undefined),
        fetchMetadataUnits(),
        fetchMetadataProvinces(),
        fetchCertificationNames(),
      ])

      const productCards = await Promise.all(
        productList.map(async (product) => {
          let batches: Awaited<ReturnType<typeof getProductBatches>> = []
          let detail: SupplierProductDetail | null = null
          try {
            batches = await getProductBatches(product.id)
          } catch {
            batches = []
          }
          try {
            detail = await getSupplierProductDetail(product.id)
          } catch {
            detail = null
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
            certifications: detail?.certifications ?? [],
          }
        }),
      )

      setProducts(productCards)
      setCategories(categoryList.map((item) => ({ ...item, name: normalizeCategoryName(item.name, item.id) })))
      setUnits(unitList)
      setProvinces(provinceList)
      setCertificationNames(certNameList)
    } catch {
      showToast('Không thể tải dữ liệu sản phẩm.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInitial()
  }, [companyId, userId])

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

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>()
    categories.forEach((item) => {
      map.set(item.id, item.name)
    })
    return map
  }, [categories])

  const summary = useMemo(() => {
    const total = products.length
    const active = products.filter((p) => p.stockStatus === 'con-hang').length
    const low = products.filter((p) => p.stockStatus === 'sap-het').length
    return { total, active, low }
  }, [products])

  const resetProductForm = () => {
    setProductModalStep(1)
    setProductName('')
    setProductCategoryId('')
    setProductUnit('')
    setProductProvince('')
    setProductDescription('')
    setProductImageUrls([])
    setNewCategoryName('')
    setNewCategoryError('')
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
      showToast('Không thể tải dữ liệu để sửa sản phẩm.', 'error')
    }
  }

  const uploadDocument = async (file: File, onDone: (url: string) => void, setBusy?: (value: boolean) => void) => {
    setBusy?.(true)
    try {
      const uploaded = await uploadSupplierDocument(file)
      onDone(uploaded.url)
    } catch {
      showToast('Upload tài liệu thất bại.', 'error')
    } finally {
      setBusy?.(false)
    }
  }

  const uploadVideo = async (file: File) => {
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
      setBatchForm((prev) => ({ ...prev, videoUrl: uploaded.url }))
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

  const addCertificationBox = () => {
    const certName = certDraft.optionName === '__custom__' ? certDraft.customName.trim() : certDraft.optionName.trim()

    if (!certName) {
      showToast('Vui lòng chọn hoặc nhập tên chứng nhận.', 'error')
      return
    }

    if (!certDraft.issuedDate || !certDraft.expiryDate) {
      showToast('Ngày cấp và ngày hết hạn của chứng nhận là bắt buộc.', 'error')
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    if (certDraft.issuedDate > today) {
      showToast('Ngày cấp không được ở tương lai.', 'error')
      return
    }

    if (certDraft.expiryDate < today) {
      showToast('Ngày hết hạn không được ở quá khứ.', 'error')
      return
    }

    if (certDraft.expiryDate <= certDraft.issuedDate) {
      showToast('Ngày hết hạn phải sau ngày cấp.', 'error')
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

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!userId) {
      setNewCategoryError('Thiếu thông tin người dùng.')
      return
    }
    if (!name) {
      setNewCategoryError('Vui lòng nhập tên danh mục.')
      return
    }
    if (categories.some((category) => category.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewCategoryError('Danh mục đã tồn tại trong tài khoản này.')
      return
    }

    setCreatingCategory(true)
    setNewCategoryError('')
    try {
      const created = await createSupplierCategory({ userId, name })
      const categoryList = await fetchCategories(userId)
      setCategories(categoryList.map((item) => ({ ...item, name: normalizeCategoryName(item.name, item.id) })))
      setProductCategoryId(String(created.id))
      setNewCategoryName('')
      showToast('Đã thêm danh mục mới.', 'success')
    } catch {
      setNewCategoryError('Không thể thêm danh mục. Vui lòng kiểm tra tên có bị trùng không.')
    } finally {
      setCreatingCategory(false)
    }
  }

  const validateProductInput = (): boolean => {
    if (!productName.trim()) {
      showToast('Tên sản phẩm là bắt buộc.', 'error')
      return false
    }
    if (!productCategoryId) {
      showToast('Danh mục là bắt buộc.', 'error')
      return false
    }
    if (!productUnit) {
      showToast('Đơn vị là bắt buộc.', 'error')
      return false
    }
    if (!productProvince) {
      showToast('Tỉnh xuất xứ là bắt buộc.', 'error')
      return false
    }
    return true
  }

  const validateBatchInput = (): boolean => {
    if (!batchForm.harvestDate) {
      showToast('Ngày thu hoạch/đánh bắt là bắt buộc.', 'error')
      return false
    }

    const today = new Date().toISOString().slice(0, 10)
    if (batchForm.harvestDate > today) {
      showToast('Ngày thu hoạch/đánh bắt không được ở tương lai.', 'error')
      return false
    }

    if (batchForm.expiryDate && batchForm.expiryDate < today) {
      showToast('Ngày hết hạn không được ở quá khứ.', 'error')
      return false
    }

    if (batchForm.expiryDate && batchForm.expiryDate <= batchForm.harvestDate) {
      showToast('Ngày hết hạn phải sau ngày thu hoạch.', 'error')
      return false
    }

    if (!batchForm.grade) {
      showToast('Grade là bắt buộc.', 'error')
      return false
    }

    if (!batchForm.quantity || Number(batchForm.quantity) <= 0) {
      showToast('Tồn kho phải lớn hơn 0.', 'error')
      return false
    }

    if (!batchForm.price || Number(batchForm.price) <= 0) {
      showToast('Giá phải lớn hơn 0.', 'error')
      return false
    }

    if (!batchForm.qcResult) {
      showToast('Kết quả QC là bắt buộc.', 'error')
      return false
    }

    if (batchForm.qcResult === 'PASS' && !batchForm.qcDocumentUrl.trim()) {
      showToast('PASS bắt buộc có file kiểm định.', 'error')
      return false
    }

    if (batchForm.qcResult === 'FAIL' && !batchForm.qcNotes.trim()) {
      showToast('FAIL bắt buộc có ghi chú kiểm định.', 'error')
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
      videoUrl: toAbsoluteUploadedUrl(batchForm.videoUrl),
      imageUrls: batchForm.imageUrls
        .map((url) => toAbsoluteUploadedUrl(url))
        .filter((url): url is string => Boolean(url))
        .filter((url, index, list) => url.length > 0 && list.indexOf(url) === index),
      qc: {
        result: batchForm.qcResult as 'PASS' | 'FAIL',
        documentUrl: toAbsoluteUploadedUrl(batchForm.qcDocumentUrl),
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
      imageUrls: productImageUrls
        .map((url) => toAbsoluteUploadedUrl(url))
        .filter((url): url is string => Boolean(url)),
      certifications: certItems.map((item) => ({
        name: item.name,
        documentUrl: toAbsoluteUploadedUrl(item.documentUrl),
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

    try {
      if (editingProductId) {
        await updateSupplierProduct(editingProductId, toProductUpdatePayload())
        showToast('Cập nhật sản phẩm thành công.', 'success')
      } else {
        const payload: CreateProductOnlyRequest = {
          supplierCompanyId: companyId,
          product: {
            name: productName.trim(),
            categoryId: Number(productCategoryId),
            unit: productUnit,
            originProvince: productProvince,
            description: productDescription.trim() || undefined,
            imageUrls: productImageUrls
              .map((url) => toAbsoluteUploadedUrl(url))
              .filter((url): url is string => Boolean(url)),
            certifications: certItems.map((item) => ({
              name: item.name,
              documentUrl: toAbsoluteUploadedUrl(item.documentUrl),
              issuedBy: item.issuedBy || undefined,
              issuedDate: item.issuedDate || undefined,
              expiryDate: item.expiryDate || undefined,
            })),
          },
        }
        await createProductOnly(payload)
        showToast('Tạo sản phẩm thành công.', 'success')
      }

      setOpenProductModal(false)
      resetProductForm()
      await loadInitial()
    } catch {
      showToast(editingProductId ? 'Cập nhật sản phẩm thất bại.' : 'Tạo sản phẩm thất bại.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const submitProductWithFirstBatch = async () => {
    if (editingProductId) {
      showToast('Chế độ sửa sản phẩm không áp dụng tạo lô hàng đầu tiên.', 'error')
      return
    }

    if (!validateProductInput() || !validateBatchInput() || !companyId || !userId) {
      return
    }

    setSubmitting(true)

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
          imageUrls: productImageUrls
            .map((url) => toAbsoluteUploadedUrl(url))
            .filter((url): url is string => Boolean(url)),
          certifications: certItems.map((item) => ({
            name: item.name,
            documentUrl: toAbsoluteUploadedUrl(item.documentUrl),
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
      showToast('Tạo sản phẩm và lô hàng thành công.', 'success')
      await loadInitial()
      navigate(`/supplier/products/${response.product.id}/lots`)
    } catch {
      showToast('Tạo sản phẩm và lô hàng thất bại.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCreateBatch = async () => {
    if (!selectedProductId) {
      showToast('Vui lòng chọn sản phẩm để tạo lô hàng.', 'error')
      return
    }

    if (!validateBatchInput() || !userId) {
      return
    }

    setSubmitting(true)

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
      showToast('Tạo lô hàng thất bại.', 'error')
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
      showToast('Không thể tải chi tiết sản phẩm.', 'error')
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    const confirmed = await showConfirm('Xóa sản phẩm này và toàn bộ lô hàng liên quan?', {
      title: 'Xác nhận xóa sản phẩm',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
    })
    if (!confirmed) {
      return
    }

    try {
      await deleteSupplierProduct(productId)
      await loadInitial()
      showToast('Đã xóa sản phẩm thành công.', 'success')
    } catch (error) {
      showToast(readApiErrorMessage(error) || 'Không thể xóa sản phẩm.', 'error')
    }
  }

  return (
    <>
      <SupplierShell
        activeKey="products"
        title="Sản phẩm & Lô hàng"
        subtitle="Quản lý sản phẩm và lô hàng của bạn"
      >
        <div className="flex h-full flex-col gap-3">
          {/* ── Sticky top: summary chips + filter + buttons ── */}
          <div className="shrink-0 space-y-2">
            {/* Summary chips row */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                <span>{summary.total}</span>
                <span className="text-slate-400">sản phẩm</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
                <Flame className="h-3.5 w-3.5" />
                <span>{summary.active}</span>
                <span className="text-emerald-500">còn hàng</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm">
                <Layers className="h-3.5 w-3.5" />
                <span>{summary.low}</span>
                <span className="text-amber-500">sắp hết</span>
              </div>
              {/* Push buttons to right */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-95"
                  onClick={() => openCreateBatchModal()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tạo lô hàng
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:opacity-90 active:scale-95"
                  onClick={openCreateProductModal}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm sản phẩm
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 backdrop-blur-sm md:grid-cols-6">
              <label className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên sản phẩm..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="">Danh mục</option>
                {categories.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.name}</option>
                ))}
              </select>
              <select
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="">Tỉnh xuất xứ</option>
                {provinces.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | StockStatus)}
                className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="">Trạng thái</option>
                <option value="con-hang">Còn hàng</option>
                <option value="sap-het">Sắp hết</option>
                <option value="het-hang">Hết hàng</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="newest">Mới nhất</option>
                <option value="price-asc">Giá tăng dần</option>
                <option value="price-desc">Giá giảm dần</option>
              </select>
            </div>
          </div>

          {loading ? <ProductsSkeletonLoader /> : null}

          {/* ── Product Grid (scrollable) ── */}
          {!loading && (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredProducts.map((item) => (
            <article
              key={item.product.id}
              className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-emerald-300 hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)] hover:-translate-y-0.5"
              onClick={() => navigate(`/supplier/products/${item.product.id}/lots`)}
            >
              {/* Thumbnail */}
              <div className="relative h-28 shrink-0 overflow-hidden bg-slate-100">
                <img
                  src={resolveUploadedFileUrl(item.product.imageUrl) || 'https://placehold.co/420x220?text=No+Image'}
                  alt={item.product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                {/* Badges */}
                <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                  {item.batches.length} lô
                </span>
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold backdrop-blur-sm ${stockStatusBadge(item.stockStatus)}`}
                >
                  {stockStatusLabel(item.stockStatus)}
                </span>
                {item.certifications.length > 0 && (
                  <button
                    className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow backdrop-blur-sm transition hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCertPreviewProduct({ name: item.product.name, certifications: item.certifications })
                    }}
                  >
                    <Award className="h-3 w-3" />
                    {item.certifications.length} chứng chỉ
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div>
                  <h3 className="truncate text-[15px] font-bold text-slate-900">{item.product.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {item.product.originProvince || 'N/A'}
                    <span className="mx-1">·</span>
                    {categoryNameById.get(item.product.categoryId) || item.product.categoryName || 'N/A'}
                  </p>
                </div>

                {item.batches.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-slate-400">
                    Chưa có lô hàng
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <InfoChip label="Grade" value={item.latestBatch?.grade || 'N/A'} />
                      <InfoChip label="Size" value={item.latestBatch?.size || 'N/A'} />
                      <InfoChip label="Tồn kho" value={`${item.totalQuantity}${item.product.unit}`} highlight />
                      <InfoChip label="MOQ" value={`${item.latestBatch?.moq ?? 0}${item.product.unit}`} />
                    </div>
                    <div className="mt-auto rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Giá bán</p>
                      <p className="text-lg font-black text-emerald-700">
                        {formatBatchPriceRange(item.batches, item.product.unit)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto grid grid-cols-[1fr_auto_auto_auto] gap-1.5 border-t border-slate-100 pt-2">
                  <button
                    className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 px-2 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation()
                      openCreateBatchModal(item.product.id)
                    }}
                  >
                    + Thêm lô
                  </button>
                  <button
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation()
                      void openEditProductModal(item.product.id)
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 active:scale-95"
                    title="Xem chi tiết"
                    onClick={(e) => {
                      e.stopPropagation()
                      void openProductDetail(item.product.id)
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 active:scale-95"
                    title="Xóa sản phẩm"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDeleteProduct(item.product.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!loading && filteredProducts.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16">
              <Package2 className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">Không tìm thấy sản phẩm nào</p>
              <p className="mt-1 text-xs text-slate-400">Thử thay đổi bộ lọc hoặc thêm sản phẩm mới</p>
            </div>
          )}
            </div>
          </div>
          )}
        </div>
      </SupplierShell>

      {/* ─── Product Modal ─── */}
      {openProductModal ? (
        <div className={modalBackdropClass}>
          <div className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4">
              <h3 className="text-base font-bold text-white">
                {editingProductId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
              </h3>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                onClick={() => setOpenProductModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step tabs */}
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5">
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  className={`rounded-lg px-3 py-1.5 transition ${productModalStep === 1 ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => setProductModalStep(1)}
                >
                  1. Thông tin sản phẩm
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 transition ${productModalStep === 2 ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'} disabled:opacity-40`}
                  onClick={() => setProductModalStep(2)}
                  disabled={Boolean(editingProductId)}
                >
                  2. Lô hàng đầu tiên
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5 text-sm">
              {productModalStep === 1 ? (
                <div className="space-y-3">
                  <Field label="Tên sản phẩm" value={productName} onChange={setProductName} required />
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldSelect
                        label="Danh mục"
                        value={productCategoryId}
                        onChange={setProductCategoryId}
                        required
                        options={categories.map((item) => ({ label: item.name, value: String(item.id) }))}
                      />
                      {!editingProductId ? (
                        <div>
                          <div className="flex gap-2">
                            <input
                              className={`h-9 min-w-0 flex-1 rounded-xl border bg-slate-50 px-3 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-emerald-100 ${
                                newCategoryError ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'
                              }`}
                              value={newCategoryName}
                              onChange={(event) => {
                                setNewCategoryName(event.target.value)
                                setNewCategoryError('')
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void handleCreateCategory()
                                }
                              }}
                              placeholder="Nhập danh mục mới"
                            />
                            <button
                              type="button"
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                              onClick={() => void handleCreateCategory()}
                              disabled={creatingCategory}
                            >
                              {creatingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              Thêm
                            </button>
                          </div>
                          {newCategoryError ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{newCategoryError}</p> : null}
                        </div>
                      ) : null}
                    </div>
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

                  {/* Images */}
                  <section>
                    <p className="mb-2 text-xs font-semibold text-slate-700">Hình ảnh sản phẩm</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {productImageUrls.map((url) => {
                        const previewUrl = resolveUploadedFileUrl(url)
                        return (
                          <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                            <img
                              src={previewUrl || 'https://placehold.co/160x160?text=No+Image'}
                              alt="preview"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100"
                              onClick={() => setProductImageUrls((prev) => prev.filter((i) => i !== url))}
                            >
                              <X className="h-4 w-4 text-white" />
                            </button>
                          </div>
                        )
                      })}
                      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50">
                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Upload className="h-4 w-4" />}
                        <span>Tải lên</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              void uploadDocument(
                                file,
                                (url) =>
                                  setProductImageUrls((prev) => {
                                    if (prev.includes(url)) return prev
                                    return [...prev, url]
                                  }),
                                setUploadingImage,
                              )
                            }
                            e.currentTarget.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </section>

                  {/* Certifications */}
                  <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-4">
                    <p className="mb-3 text-sm font-bold text-emerald-900">Chứng nhận / Tiêu chuẩn</p>
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
                        label="Tên tùy chỉnh"
                        value={certDraft.customName}
                        onChange={(value) => setCertDraft((prev) => ({ ...prev, customName: value }))}
                      />
                    ) : null}

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
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

                    <div className="mt-3 flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50">
                        <Upload className="h-3 w-3" />
                        File chứng nhận
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              void uploadDocument(file, (url) =>
                                setCertDraft((prev) => ({
                                  ...prev,
                                  documentUrl: url,
                                  documentName: file.name,
                                })),
                              )
                            }
                            e.currentTarget.value = ''
                          }}
                        />
                      </label>
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                        onClick={addCertificationBox}
                      >
                        Thêm chứng nhận
                      </button>
                    </div>

                    {certDraft.documentUrl ? (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        ✓ Đã tải lên: {certDraft.documentName || certDraft.documentUrl}
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {certItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-emerald-900">{item.name}</p>
                            <p className="mt-0.5 truncate text-emerald-700">
                              Cấp bởi {item.issuedBy || 'N/A'} · {item.issuedDate || 'N/A'} → {item.expiryDate || 'N/A'}
                            </p>
                            {item.documentUrl ? (
                              <a
                                className="mt-0.5 truncate text-emerald-600 underline"
                                href={item.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem tài liệu
                              </a>
                            ) : null}
                          </div>
                          <button
                            className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition hover:bg-rose-100"
                            onClick={() => setCertItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <BatchFormFields
                  form={batchForm}
                  setForm={setBatchForm}
                  unit={productUnit || 'kg'}
                  uploadingQcFile={uploadingQcFile}
                  uploadingVideo={uploadingVideo}
                  uploadingBatchImage={uploadingBatchImage}
                  showBatchImages
                  onUploadQc={(file) =>
                    void uploadDocument(
                      file,
                      (url) => setBatchForm((prev) => ({ ...prev, qcDocumentUrl: url })),
                      setUploadingQcFile,
                    )
                  }
                  onUploadVideo={(file) => void uploadVideo(file)}
                  onUploadBatchImage={(file) =>
                    void uploadDocument(
                      file,
                      (url) =>
                        setBatchForm((prev) => {
                          if (prev.imageUrls.includes(url)) return prev
                          return { ...prev, imageUrls: [...prev.imageUrls, url] }
                        }),
                      setUploadingBatchImage,
                    )
                  }
                />
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={() => setOpenProductModal(false)}
              >
                Hủy
              </button>
              <div className="flex items-center gap-2">
                {productModalStep === 2 && !editingProductId ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    onClick={() => setProductModalStep(1)}
                  >
                    <ChevronLeft className="h-4 w-4" /> Quay lại
                  </button>
                ) : null}

                {productModalStep === 1 && !editingProductId ? (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    onClick={() => setProductModalStep(2)}
                  >
                    Tiếp theo <ChevronDown className="h-4 w-4" />
                  </button>
                ) : null}

                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50 active:scale-95"
                  disabled={submitting}
                  onClick={() => void submitProductOnly()}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingProductId ? 'Lưu cập nhật' : 'Thêm sản phẩm'}
                </button>

                {!editingProductId ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-emerald-900 disabled:opacity-50 active:scale-95"
                    disabled={submitting}
                    onClick={() => void submitProductWithFirstBatch()}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Tạo sản phẩm & lô
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Batch Modal ─── */}
      {openBatchModal ? (
        <div className={modalBackdropClass}>
          <div className="my-4 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Tạo lô hàng mới</h3>
                <p className="text-xs text-white/70">Chọn sản phẩm và nhập thông tin lô hàng</p>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                onClick={() => setOpenBatchModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
              <FieldSelect
                label="Sản phẩm"
                value={selectedProductId ? String(selectedProductId) : ''}
                onChange={(value) => setSelectedProductId(value ? Number(value) : null)}
                required
                options={products.map((item) => ({ label: item.product.name, value: String(item.product.id) }))}
              />
              <BatchFormFields
                form={batchForm}
                setForm={setBatchForm}
                unit={selectedProductCard?.product.unit || 'kg'}
                uploadingQcFile={uploadingQcFile}
                uploadingVideo={uploadingVideo}
                uploadingBatchImage={uploadingBatchImage}
                showBatchImages
                onUploadQc={(file) =>
                  void uploadDocument(
                    file,
                    (url) => setBatchForm((prev) => ({ ...prev, qcDocumentUrl: url })),
                    setUploadingQcFile,
                  )
                }
                onUploadVideo={(file) => void uploadVideo(file)}
                onUploadBatchImage={(file) =>
                  void uploadDocument(
                    file,
                    (url) =>
                      setBatchForm((prev) => {
                        if (prev.imageUrls.includes(url)) return prev
                        return { ...prev, imageUrls: [...prev.imageUrls, url] }
                      }),
                    setUploadingBatchImage,
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={() => setOpenBatchModal(false)}
              >
                Hủy
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50 active:scale-95"
                disabled={submitting}
                onClick={() => void submitCreateBatch()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Thêm lô hàng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Product Detail Modal ─── */}
      {openProductDetailModal && selectedProductDetail ? (
        <div className={modalBackdropClass}>
          <div className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]">

            {/* ── Header ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-5 py-4">
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.7) 0%, transparent 55%)' }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Primary image avatar */}
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-white/30 shadow-lg">
                    <img
                      src={resolveUploadedFileUrl(selectedProductDetail.imageUrls[0] || '') || 'https://placehold.co/80x80?text=SP'}
                      alt={selectedProductDetail.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white drop-shadow">{selectedProductDetail.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
                      <MapPin className="h-3 w-3" />
                      {selectedProductDetail.originProvince || 'N/A'}
                      <span className="opacity-50">·</span>
                      {selectedProductDetail.unit}
                      <span className="opacity-50">·</span>
                      {selectedProductDetail.categoryName}
                    </p>
                  </div>
                </div>
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                  onClick={() => setOpenProductDetailModal(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Stat pills */}
              <div className="relative mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  <Layers className="h-3 w-3" />
                  {selectedProductDetail.batches.length} lô hàng
                </span>
                {selectedProductDetail.certifications.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    <Award className="h-3 w-3" />
                    {selectedProductDetail.certifications.length} chứng chỉ
                  </span>
                )}
                {selectedProductDetail.imageUrls.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    <ShoppingBag className="h-3 w-3" />
                    {selectedProductDetail.imageUrls.length} ảnh
                  </span>
                )}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="max-h-[70vh] overflow-y-auto">

              {/* Gallery */}
              {selectedProductDetail.imageUrls.length > 0 && (
                <div className="border-b border-slate-100 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Hình ảnh sản phẩm</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedProductDetail.imageUrls.map((url, idx) => (
                      <img
                        key={url + idx}
                        src={resolveUploadedFileUrl(url) || 'https://placehold.co/120x120?text=No+Image'}
                        alt={`product-${idx}`}
                        className="h-24 w-24 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm transition hover:scale-105"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-4">
                {[
                  { label: 'Danh mục', value: selectedProductDetail.categoryName },
                  { label: 'Đơn vị', value: selectedProductDetail.unit },
                  { label: 'Xuất xứ', value: selectedProductDetail.originProvince || 'N/A' },
                  { label: 'Số lô hàng', value: String(selectedProductDetail.batches.length) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-800 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {selectedProductDetail.description && (
                <div className="border-b border-slate-100 p-4">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mô tả sản phẩm</p>
                  <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {selectedProductDetail.description}
                  </p>
                </div>
              )}

              {/* Certifications */}
              {selectedProductDetail.certifications.length > 0 && (
                <div className="border-b border-slate-100 p-4">
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Chứng chỉ & Chứng nhận</p>
                  <div className="space-y-2">
                    {selectedProductDetail.certifications.map((cert, idx) => (
                      <div
                        key={cert.id ?? idx}
                        className="flex items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Award className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <p className="text-sm font-bold text-emerald-900 truncate">{cert.name}</p>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-emerald-700">
                            {cert.issuedBy && (
                              <span><span className="font-semibold text-emerald-500">Cấp bởi:</span> {cert.issuedBy}</span>
                            )}
                            {cert.issuedDate && (
                              <span><span className="font-semibold text-emerald-500">Ngày cấp:</span> {cert.issuedDate}</span>
                            )}
                            {cert.expiryDate && (
                              <span><span className="font-semibold text-emerald-500">Hết hạn:</span> {cert.expiryDate}</span>
                            )}
                          </div>
                        </div>
                        {cert.documentUrl ? (
                          <a
                            href={resolveUploadedFileUrl(cert.documentUrl) || cert.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Xem
                          </a>
                        ) : (
                          <span className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[11px] text-slate-400">
                            Chưa có file
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch summary */}
              {selectedProductDetail.batches.length > 0 && (
                <div className="p-4">
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tóm tắt lô hàng</p>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Mã lô</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Grade</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Tồn kho</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Giá</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProductDetail.batches.map((batch, idx) => (
                          <tr
                            key={batch.id}
                            className={`border-b border-slate-100 transition hover:bg-emerald-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          >
                            <td className="px-3 py-2 font-bold text-slate-800">{batch.batchCode || `#${batch.id}`}</td>
                            <td className="px-3 py-2">
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                {batch.grade}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700">
                              {batch.quantity}{selectedProductDetail.unit}
                            </td>
                            <td className="px-3 py-2 font-bold text-emerald-700">
                              {Number(batch.price).toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                batch.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {batch.status === 'ACTIVE' ? 'Đang bán' : batch.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Empty batch state */}
              {selectedProductDetail.batches.length === 0 && (
                <div className="p-6 text-center">
                  <Package2 className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">Chưa có lô hàng nào</p>
                </div>
              )}
            </div>

          </div>
        </div>
      ) : null}


      {/* ─── Cert Preview Modal ─── */}
      {certPreviewProduct ? (
        <div className={modalBackdropClass}>
          <div className="my-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Chứng chỉ sản phẩm</h3>
                <p className="text-xs text-white/70">{certPreviewProduct.name}</p>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                onClick={() => setCertPreviewProduct(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {certPreviewProduct.certifications.length === 0 ? (
                <p className="text-center text-sm text-slate-500">Sản phẩm chưa có chứng chỉ.</p>
              ) : (
                <div className="space-y-2.5">
                  {certPreviewProduct.certifications.map((cert) => (
                    <div
                      key={cert.id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-emerald-900">{cert.name}</p>
                          <p className="mt-0.5 text-xs text-emerald-700">
                            Cấp bởi: {cert.issuedBy || 'N/A'} · Ngày cấp: {cert.issuedDate || 'N/A'} · Hết hạn: {cert.expiryDate || 'N/A'}
                          </p>
                        </div>
                        {cert.documentUrl ? (
                          <a
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                            href={resolveUploadedFileUrl(cert.documentUrl) || cert.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Xem
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function InfoChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xs font-bold ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
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
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
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
        onChange={(e) => onChange(e.target.value)}
        className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
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
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
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
